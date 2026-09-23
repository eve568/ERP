import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationError, requireFields } from '../src/utils/validation.js';

test('requireFields acepta un payload completo', () => {
  assert.doesNotThrow(() => requireFields({ name: 'Demo', email: 'demo@example.com' }, ['name', 'email']));
});

test('requireFields identifica campos obligatorios faltantes', () => {
  assert.throws(
    () => requireFields({ name: 'Demo' }, ['name', 'email']),
    (error) => error instanceof ValidationError
      && error.statusCode === 400
      && error.details.missingFields.includes('email')
  );
});