import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env, validateEnvironment } from './config/env.js';

validateEnvironment();

const app = createApp();
const databaseConnected = await connectDatabase(env.mongodbUri);

if (env.nodeEnv === 'production' && !databaseConnected) {
  console.error('El backend no puede iniciar en producción sin conexión a MongoDB.');
  process.exit(1);
}

const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`ERP API escuchando en el puerto ${env.port}`);
});

async function shutdown(signal) {
  console.log(`Recibida señal ${signal}. Cerrando ERP API...`);

  server.close(async () => {
    try {
      await disconnectDatabase();
      process.exit(0);
    } catch (error) {
      console.error('Error durante el cierre de MongoDB:', error);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
