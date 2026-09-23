import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Sale } from '../src/models/sale.model.js';

env.jwtSecret = 'test-secret-only';
const server = createApp().listen(0);
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const token = jwt.sign({ sub: '507f1f77bcf86cd799439013', role: 'VENTAS', companyId: '507f1f77bcf86cd799439011' }, env.jwtSecret);
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

test.after(() => server.close());

test('Ventas requiere autenticación', async () => {
  const response = await fetch(`${baseUrl}/api/sales`);
  assert.equal(response.status, 401);
});

test('Crear venta valida campos mínimos', async () => {
  const response = await fetch(`${baseUrl}/api/sales`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ paymentMethod: 'CASH' })
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body.details.missingFields, ['customerId', 'items']);
});

test('Confirmar venta exige almacén', async () => {
  const response = await fetch(`${baseUrl}/api/sales/507f1f77bcf86cd799439014/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body.details.missingFields, ['warehouseId']);
});

test('El modelo de venta contiene estados y trazabilidad', () => {
  assert.equal(Sale.schema.path('status').enumValues.includes('CONFIRMED'), true);
  assert.equal(Sale.schema.path('userId').options.required, true);
  assert.equal(Sale.schema.indexes().some(([fields]) => fields.companyId === 1 && fields.createdAt === -1), true);
});
