import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Company } from '../src/models/company.model.js';
import { Branch } from '../src/models/branch.model.js';

env.jwtSecret = 'test-secret-only';
const server = createApp().listen(0);
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

test.after(() => server.close());

function tokenFor(role = 'ADMIN', companyId) {
  return jwt.sign({ sub: 'test-user', role, companyId, email: 'test@example.com' }, env.jwtSecret);
}

test('Las rutas de empresas requieren autenticación', async () => {
  const response = await fetch(`${baseUrl}/api/companies`);
  assert.equal(response.status, 401);
});

test('Crear empresa no simula persistencia sin MongoDB', async () => {
  const response = await fetch(`${baseUrl}/api/companies`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tokenFor()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Demo', legalName: 'Demo SA', taxId: 'DEMO-001' })
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.message, 'El servicio de empresas no está disponible');
});

test('Consultar sucursales requiere companyId', async () => {
  const response = await fetch(`${baseUrl}/api/branches`, {
    headers: { authorization: `Bearer ${tokenFor('ADMIN')}` }
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body.details.missingFields, ['companyId']);
});

test('Los modelos tienen índices de unicidad multiempresa', () => {
  assert.equal(Company.schema.indexes().some(([fields, options]) => fields.taxId === 1 && options.unique), true);
  assert.equal(Branch.schema.indexes().some(([fields, options]) => fields.companyId === 1 && fields.name === 1 && options.unique), true);
});