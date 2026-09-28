import { Router } from 'express';
import { getDatabaseState } from '../config/database.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

router.get('/', (request, response) => {
  return sendSuccess(response, {
    service: 'erp-backend',
    status: 'ok',
    database: getDatabaseState(),
    timestamp: new Date().toISOString()
  }, 'API disponible');
});

router.get('/ready', (request, response) => {
  const database = getDatabaseState();

  if (database !== 'connected') {
    return response.status(503).json({
      success: false,
      data: {
        service: 'erp-backend',
        status: 'not_ready',
        database,
        timestamp: new Date().toISOString()
      },
      message: 'La API no está lista porque MongoDB no está conectado'
    });
  }

  return sendSuccess(response, {
    service: 'erp-backend',
    status: 'ready',
    database,
    timestamp: new Date().toISOString()
  }, 'API lista');
});

export default router;
