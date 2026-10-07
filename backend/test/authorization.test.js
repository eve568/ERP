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

test('Modo de pruebas permite a EMPLEADO acceder a una ruta administrativa', async () => {
  const response = await fetch(`${baseUrl}/api/auth/admin-check`, {
    headers: { authorization: `Bearer ${tokenFor('EMPLEADO')}` }
  });

  assert.equal(response.status, 200);
});

test('Los permisos se validan en backend por rol', () => {
  assert.equal(roleHasPermission('FINANZAS', 'EXPORT'), true);
  assert.equal(roleHasPermission('VENTAS', 'DELETE'), false);
});

test('Modo de pruebas no bloquea CREATE por rol', async () => {
  const token = tokenFor('EMPLEADO');
  const requests = [
    fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({})
    }),
    fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({})
    }),
    fetch(`${baseUrl}/api/finance/incomes`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({})
    })
  ];

  const responses = await Promise.all(requests);
  assert.ok(responses.every((response) => response.status !== 403));
});

test('Modo de pruebas no bloquea EXPORT por rol', async () => {
  const response = await fetch(`${baseUrl}/api/reports/sales`, {
    headers: { authorization: `Bearer ${tokenFor('EMPLEADO')}` }
  });

  assert.notEqual(response.status, 403);
});
