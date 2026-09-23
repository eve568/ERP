import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, disconnectDatabase, getDatabaseState } from '../src/config/database.js';

test('MongoDB sin URI real queda marcado como no configurado', async () => {
  const connected = await connectDatabase('mongodb+srv://<usuario>:<password>@<cluster>/<base_de_datos>');

  assert.equal(connected, false);
  assert.equal(getDatabaseState(), 'not_configured');
  await disconnectDatabase();
  assert.equal(getDatabaseState(), 'disconnected');
});
