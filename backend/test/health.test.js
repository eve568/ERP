import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const server = createApp().listen(0);
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

test.after(() => server.close());

test('GET /api/health devuelve una respuesta consistente', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'ok');
});

test('GET /api/health/ready devuelve 503 cuando MongoDB no está conectado', async () => {
  const response = await fetch(`${baseUrl}/api/health/ready`);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.success, false);
  assert.equal(body.data.status, 'not_ready');
});

test('GET /ruta-inexistente devuelve 404 seguro', async () => {
  const response = await fetch(`${baseUrl}/ruta-inexistente`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.equal(body.error, undefined);
});

test('JSON inválido devuelve 400 sin exponer detalles internos', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{'
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /JSON/i);
});

test('CORS rechaza un origen que no está configurado', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { origin: 'https://untrusted.example' }
  });

  assert.equal(response.headers.get('access-control-allow-origin'), null);
});
