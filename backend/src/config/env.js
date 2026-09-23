import 'dotenv/config';

const requiredEnvironment = ['PORT', 'MONGODB_URI'];

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: process.env.MONGODB_URI ?? '',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:8081').split(',').map((origin) => origin.trim()).filter(Boolean),
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m'
};

export function validateEnvironment() {
  const missing = requiredEnvironment.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  }
  if (env.nodeEnv === 'production' && env.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
  }
}
