import { AppError } from './errors.js';

export class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 400, details);
    this.name = 'ValidationError';
  }
}

export function requireFields(payload, fields) {
  const missingFields = fields.filter((field) => {
    const value = payload?.[field];
    return value === undefined || value === null || value === '';
  });

  if (missingFields.length > 0) {
    throw new ValidationError('Faltan campos obligatorios', { missingFields });
  }
}