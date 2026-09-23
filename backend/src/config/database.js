import mongoose from 'mongoose';

let databaseState = 'disconnected';

mongoose.set('strictQuery', true);
mongoose.connection.on('connected', () => {
  databaseState = 'connected';
});
mongoose.connection.on('disconnected', () => {
  databaseState = 'disconnected';
});
mongoose.connection.on('error', () => {
  databaseState = 'error';
});

export async function connectDatabase(uri) {
  if (!uri || uri.includes('<usuario>') || uri.includes('<password>')) {
    databaseState = 'not_configured';
    return false;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    databaseState = 'connected';
    return true;
  } catch (error) {
    databaseState = 'error';
    console.error('No se pudo conectar a MongoDB:', error.message);
    return false;
  }
}

export function getDatabaseState() {
  return databaseState;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  databaseState = 'disconnected';
}
