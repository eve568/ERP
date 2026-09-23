import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Customer } from '../src/models/customer.model.js';
import { Supplier } from '../src/models/supplier.model.js';

env.jwtSecret = 'test-secret-only';
const server = createApp().listen(0);
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

test.after(() => server.close());

function tokenFor(companyId = '507f1f77bcf86cd799439011') {
  return jwt.sign({ sub: 'test-user', role: 'EMPLEADO', companyId }, env.jwtSecret);
}

test('Clientes y proveedores requieren autenticación', async () => {
  const [customers, suppliers] = await Promise.all([
    fetch(`${baseUrl}/api/customers`),
    fetch(`${baseUrl}/api/suppliers`)
  ]);

  assert.equal(customers.status, 401);
  assert.equal(suppliers.status, 401);
});

test('Crear cliente no simula persistencia sin MongoDB', async () => {
  const response = await fetch(`${baseUrl}/api/customers`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tokenFor()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Cliente Demo' })
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.message, 'El servicio no está disponible');
});

test('Los modelos de clientes y proveedores tienen índices por empresa', () => {
  assert.equal(Customer.schema.indexes().some(([fields]) => fields.companyId === 1 && fields.name === 1), true);
  assert.equal(Supplier.schema.indexes().some(([fields]) => fields.companyId === 1 && fields.taxId === 1), true);
});
