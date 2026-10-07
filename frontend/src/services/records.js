import { apiRequest } from './api';

/**
 * Operaciones de registro del ERP.
 * Todas requieren token; el backend decide permisos y aislamiento por empresa.
 */

export function createCustomer(token, payload) {
  return createPartner(token, 'customers', payload);
}

export function createSupplier(token, payload) {
  return createPartner(token, 'suppliers', payload);
}

function createPartner(token, resource, payload) {
  return apiRequest(`/api/${resource}`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function updateCustomer(token, customerId, payload) {
  return updatePartner(token, 'customers', customerId, payload);
}

export function updateSupplier(token, supplierId, payload) {
  return updatePartner(token, 'suppliers', supplierId, payload);
}

function updatePartner(token, resource, recordId, payload) {
  return apiRequest(`/api/${resource}/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  });
}

export function deactivateCustomer(token, customerId) {
  return deactivatePartner(token, 'customers', customerId);
}

export function deactivateSupplier(token, supplierId) {
  return deactivatePartner(token, 'suppliers', supplierId);
}

function deactivatePartner(token, resource, recordId) {
  return apiRequest(`/api/${resource}/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
    token,
  });
}

export function activateCustomer(token, customerId) {
  return updateCustomer(token, customerId, { status: 'ACTIVE' });
}

export function activateSupplier(token, supplierId) {
  return updateSupplier(token, supplierId, { status: 'ACTIVE' });
}

export function createProduct(token, payload) {
  return apiRequest('/api/products', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function createCategory(token, payload) {
  return apiRequest('/api/categories', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function updateProduct(token, productId, payload) {
  return apiRequest(`/api/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
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

export function createWarehouse(token, payload) {
  return apiRequest('/api/warehouses', {
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

export function createPurchase(token, payload) {
  return apiRequest('/api/purchases', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}


export function createIncomeRecord(token, payload) {
  return apiRequest('/api/finance/incomes', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function createExpenseRecord(token, payload) {
  return apiRequest('/api/finance/expenses', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}
