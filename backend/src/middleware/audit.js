import { recordAudit } from '../services/audit.service.js';

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function auditMutations(request, response, next) {
  if (mutationMethods.has(request.method)) {
    response.once('finish', () => {
      if (response.statusCode >= 200 && response.statusCode < 300 && request.user?.sub) {
        const pathParts = request.path.split('/').filter(Boolean);
        recordAudit({
          userId: request.user.sub,
          companyId: request.user.companyId,
          action: request.method,
          module: pathParts[1] ?? 'unknown',
          recordId: request.params?.id,
          changes: request.body
        });
      }
    });
  }
  next();
}