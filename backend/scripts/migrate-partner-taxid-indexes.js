import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const { env } = await import('../src/config/env.js');
const indexName = 'companyId_1_taxId_1';
const indexOptions = {
  name: indexName,
  unique: true,
  partialFilterExpression: { taxId: { $type: 'string', $gt: '' } },
};

async function migrateCollection(collectionName) {
  const database = mongoose.connection.db;
  const collection = database.collection(collectionName);
  const collectionExists = await database
    .listCollections({ name: collectionName }, { nameOnly: true })
    .hasNext();

  if (collectionExists) {
    const indexes = await collection.listIndexes().toArray();
    const existingIndex = indexes.find((index) => index.name === indexName);
    const alreadyMigrated =
      existingIndex?.unique === true &&
      existingIndex.partialFilterExpression?.taxId?.$type === 'string' &&
      existingIndex.partialFilterExpression.taxId.$gt === '';

    if (alreadyMigrated) return;
    if (existingIndex) await collection.dropIndex(indexName);
  }

  await collection.createIndex(
    { companyId: 1, taxId: 1 },
    indexOptions
  );
}

async function main() {
  if (
    !env.mongodbUri ||
    env.mongodbUri.includes('<usuario>') ||
    env.mongodbUri.includes('<password>')
  ) {
    throw new Error('MONGODB_URI no está configurada con una conexión utilizable.');
  }

  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 5000 });
  await migrateCollection('customers');
  await migrateCollection('suppliers');
  console.log('Índices de RFC de clientes y proveedores actualizados.');
}

try {
  await main();
} catch {
  console.error(
    'No se pudieron actualizar los índices de RFC. Verifica la conexión y que no existan RFC duplicados por empresa.'
  );
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
