import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import branchRoutes from './routes/branch.routes.js';
import companyRoutes from './routes/company.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import healthRoutes from './routes/health.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import saleRoutes from './routes/sale.routes.js';
import purchaseRoutes from './routes/purchase.routes.js';
import financeRoutes from './routes/finance.routes.js';
import emailRoutes from './routes/email.routes.js';
import simpleRoutes from './routes/simple.routes.js';
import insightsRoutes from './routes/insights.routes.js';
import partnerRoutes from './routes/partner.routes.js';
import { auditMutations } from './middleware/audit.js';

function configureCors() {
  return cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    }
  });
}

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(configureCors());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  // Los módulos del ERP son datos dinámicos. Evita respuestas 304 que hagan
  // que el navegador reutilice listas antiguas después de crear registros.
  app.use('/api', (_request, response, next) => {
    response.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.set('Pragma', 'no-cache');
    response.set('Expires', '0');
    next();
  });
  // Render consulta /api/health/ready cada pocos segundos. Estas rutas deben
  // quedar fuera del rate limiter para que el propio health check no reciba
  // 429 y provoque reinicios innecesarios del servicio.
  app.use('/api/health', healthRoutes);

  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false
  }));
  app.use('/api/auth', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false
  }));
  app.use(auditMutations);

  app.get('/', (request, response) => {
    response.json({
      success: true,
      data: { service: 'erp-backend' },
      message: 'API ERP activa'
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/companies', companyRoutes);
  app.use('/api/branches', branchRoutes);
  app.use('/api', partnerRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api', inventoryRoutes);
  app.use('/api/sales', saleRoutes);
  app.use('/api/purchases', purchaseRoutes);
  app.use('/api/finance', financeRoutes);
  app.use('/api/email', emailRoutes);
  app.use('/api', simpleRoutes);
  app.use('/api', insightsRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
