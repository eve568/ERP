import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { roleHasPermission } from '../src/config/permissions.js';

env.jwtSecret = 'test-secret-only';
const server = createApp().listen(0);
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

test.after(() => server.close());

function tokenFor(role) {
  return jwt.sign({ sub: 'test-user', role, email: `${role.toLowerCase()}@example.com` }, env.jwtSecret);
}

test('ADMIN puede acceder a una ruta administrativa', async () => {
  const response = await fetch(`${baseUrl}/api/auth/admin-check`, {
    headers: { authorization: `Bearer ${tokenFor('ADMIN')}` }
  });

  assert.equal(response.status, 200);
});

test('EMPLEADO no puede acceder a una ruta administrativa', async () => {
  const response = await fetch(`${baseUrl}/api/auth/admin-check`, {
    headers: { authorization: `Bearer ${tokenFor('EMPLEADO')}` }
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
});

test('Los permisos se validan en backend por rol', () => {
  assert.equal(roleHasPermission('FINANZAS', 'EXPORT'), true);
  assert.equal(roleHasPermission('VENTAS', 'DELETE'), false);
});