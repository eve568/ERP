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

export default router;
