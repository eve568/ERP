import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';

const server = createApp().listen(0);
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

test.after(() => server.close());

test('GET /api/auth/me exige autenticación', async () => {
  const response = await fetch(`${baseUrl}/api/auth/me`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, 'Autenticación requerida');
});

test('POST /api/auth/register valida campos obligatorios', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@example.com' })
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body.details.missingFields, ['firstName', 'lastName', 'password']);
});

test('POST /api/auth/register no simula persistencia sin MongoDB', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Demo',
      lastName: 'User',
      email: 'demo@example.com',
      password: 'Password123'
    })
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.message, 'El servicio de autenticación no está disponible');
});

test('passwordHash no se selecciona por defecto', () => {
  assert.equal(User.schema.path('passwordHash').options.select, false);
});

test('Cambiar contraseña exige autenticación y campos', async () => {
  const response = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.message, 'Autenticación requerida');
});


test('El modelo de usuario conserva la relación interna con empresa', () => {
  assert.equal(User.schema.path('companyId').instance, 'ObjectId');
});

test('El contexto de empresa no se solicita como dato visible de autenticación', () => {
  assert.equal(User.schema.path('companyId').options.required, undefined);
});
