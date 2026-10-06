import { apiRequest } from './api';

/**
 * Operaciones de registro del ERP.
 * Todas requieren token; el backend decide permisos y aislamiento por empresa.
 */

export function createCustomer(token, payload) {
  return apiRequest('/api/customers', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function createProduct(token, payload) {
  return apiRequest('/api/products', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function createInventoryMovement(token, payload) {
  return apiRequest('/api/inventory/movement', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function createSale(token, payload) {
  return apiRequest('/api/sales', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}
