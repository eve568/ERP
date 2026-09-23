import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Inventory } from '../src/models/inventory.model.js';
import { InventoryMovement } from '../src/models/inventory-movement.model.js';
import { Warehouse } from '../src/models/warehouse.model.js';

env.jwtSecret = 'test-secret-only';
const server = createApp().listen(0);
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const token = jwt.sign({ sub: 'test-user', role: 'ALMACEN', companyId: '507f1f77bcf86cd799439011' }, env.jwtSecret);
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

test.after(() => server.close());

test('Inventario requiere autenticación', async () => {
  const response = await fetch(`${baseUrl}/api/inventory`);
  assert.equal(response.status, 401);
});

test('Movimiento de inventario valida campos mínimos', async () => {
  const response = await fetch(`${baseUrl}/api/inventory/movement`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'PURCHASE' })
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body.details.missingFields, ['productId', 'warehouseId', 'quantity']);
});

test('Crear almacén no simula persistencia sin MongoDB', async () => {
  const response = await fetch(`${baseUrl}/api/warehouses`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Almacén Demo', branchId: '507f1f77bcf86cd799439012' })
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.message, 'El servicio de inventario no está disponible');
});

test('Los modelos de inventario tienen índices de trazabilidad', () => {
  assert.equal(Warehouse.schema.indexes().some(([fields, options]) => fields.companyId === 1 && fields.name === 1 && options.unique), true);
  assert.equal(Inventory.schema.indexes().some(([fields, options]) => fields.warehouseId === 1 && fields.productId === 1 && options.unique), true);
  assert.equal(InventoryMovement.schema.indexes().some(([fields]) => fields.companyId === 1 && fields.createdAt === -1), true);
});
