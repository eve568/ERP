import { recordAudit } from '../services/audit.service.js';

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const sensitiveFields = new Set(['password', 'passwordHash', 'currentPassword', 'newPassword', 'token']);

function sanitizeChanges(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitizeChanges);

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveFields.has(key) ? '[REDACTED]' : sanitizeChanges(item)
    ])
  );
}

function effectiveCompanyId(request) {
  return request.body?.companyId ?? request.query?.companyId ?? request.user?.companyId ?? null;
}

export function auditMutations(request, response, next) {
  if (mutationMethods.has(request.method)) {
    response.once('finish', () => {
      if (response.statusCode >= 200 && response.statusCode < 300 && request.user?.sub) {
        const pathParts = request.path.split('/').filter(Boolean);
        const companyId = effectiveCompanyId(request);

        if (!companyId) return;

        recordAudit({
          userId: request.user.sub,
          companyId,
          action: request.method,
          module: pathParts[1] ?? 'unknown',
          recordId: request.params?.id,
          changes: sanitizeChanges(request.body)
        });
      }
    });
  }
  next();
}
