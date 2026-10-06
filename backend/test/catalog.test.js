import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { updateProduct } from '../src/modules/catalog/catalog.service.js';
import { Category } from '../src/models/category.model.js';
import { Product } from '../src/models/product.model.js';

env.jwtSecret = 'test-secret-only';
const server = createApp().listen(0);
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

test.after(() => server.close());

const token = jwt.sign({ sub: 'test-user', role: 'EMPLEADO', companyId: '507f1f77bcf86cd799439011' }, env.jwtSecret);
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

test('Catálogo requiere autenticación', async () => {
  const response = await fetch(`${baseUrl}/api/products`);
  assert.equal(response.status, 401);
});

test('Crear producto valida campos mínimos', async () => {
  const response = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Producto Demo' })
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body.details.missingFields, ['sku', 'categoryId', 'purchasePrice', 'salePrice', 'unit']);
});

test('Crear categoría no simula persistencia sin MongoDB', async () => {
  const response = await fetch(`${baseUrl}/api/categories`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Categoría Demo' })
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.message, 'El servicio de catálogo no está disponible');
});

test('Los modelos de catálogo tienen índices de empresa', () => {
  assert.equal(Category.schema.indexes().some(([fields, options]) => fields.companyId === 1 && fields.name === 1 && options.unique), true);
  assert.equal(Product.schema.indexes().some(([fields, options]) => fields.companyId === 1 && fields.sku === 1 && options.unique), true);
});

test('ADMIN no puede mover un producto a otra empresa al actualizarlo', async () => {
  const selectedCompanyId = '507f1f77bcf86cd799439011';
  const productCompanyId = '507f1f77bcf86cd799439012';
  const originalFindById = Product.findById;

  mongoose.connection.emit('connected');
  Product.findById = () => ({
    lean: async () => ({
      _id: '507f1f77bcf86cd799439013',
      companyId: new mongoose.Types.ObjectId(productCompanyId),
    }),
  });

  try {
    await assert.rejects(
      updateProduct(
        '507f1f77bcf86cd799439013',
        { companyId: selectedCompanyId, name: 'Producto modificado' },
        { sub: 'admin-user', role: 'ADMIN' }
      ),
      (error) => error.statusCode === 403
    );
  } finally {
    Product.findById = originalFindById;
    mongoose.connection.emit('disconnected');
  }
});
