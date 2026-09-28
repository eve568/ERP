import 'dotenv/config';

const requiredEnvironment = ['MONGODB_URI'];

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: process.env.MONGODB_URI ?? '',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m'
};

export function validateEnvironment() {
  const missing = requiredEnvironment.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  }

  if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
    throw new Error('PORT debe ser un número entero entre 1 y 65535');
  }

  if (env.nodeEnv === 'production') {
    if (env.jwtSecret.length < 32) {
      throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
    }

    if (env.corsOrigins.includes('*')) {
      throw new Error('CORS_ORIGIN no puede usar * en producción');
    }
  }
}
