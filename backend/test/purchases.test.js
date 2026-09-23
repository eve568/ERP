import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Purchase } from '../src/models/purchase.model.js';

env.jwtSecret = 'test-secret-only';
const server = createApp().listen(0);
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const token = jwt.sign({ sub: '507f1f77bcf86cd799439013', role: 'COMPRAS', companyId: '507f1f77bcf86cd799439011' }, env.jwtSecret);
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

test.after(() => server.close());

test('Compras requiere autenticación', async () => {
  const response = await fetch(`${baseUrl}/api/purchases`);
  assert.equal(response.status, 401);
});

test('Crear compra valida campos mínimos', async () => {
  const response = await fetch(`${baseUrl}/api/purchases`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body.details.missingFields, ['supplierId', 'items']);
});

test('Recibir compra exige almacén', async () => {
  const response = await fetch(`${baseUrl}/api/purchases/507f1f77bcf86cd799439014/receive`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body.details.missingFields, ['warehouseId']);
});

test('El modelo de compra incluye recepción y trazabilidad', () => {
  assert.equal(Purchase.schema.path('status').enumValues.includes('RECEIVED'), true);
  assert.equal(Purchase.schema.path('supplierId').options.required, true);
  assert.equal(Purchase.schema.indexes().some(([fields]) => fields.companyId === 1 && fields.createdAt === -1), true);
});
