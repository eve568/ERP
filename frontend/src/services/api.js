const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isSessionError(error) {
  return error?.status === 401;
}

function withQuery(path, params = {}) {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  );

  if (entries.length === 0) return path;

  const query = entries
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    )
    .join('&');

  return `${path}?${query}`;
}

export async function apiRequest(path, options = {}) {
  const { token, headers: customHeaders, ...requestOptions } = options;
  const headers = {
    'content-type': 'application/json',
    ...customHeaders,
  };

  if (token) headers.authorization = `Bearer ${token}`;

  let response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...requestOptions,
      headers,
    });
  } catch {
    throw new ApiError('No fue posible conectar con el servidor');
  }

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    // Algunas respuestas pueden no tener cuerpo JSON.
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? 'La API no está disponible',
      response.status
    );
  }

  return payload ?? { success: true, data: null };
}

// Health público
export async function getHealth() {
  return apiRequest('/api/health');
}

// Dashboard e información general
export async function getDashboard(token, companyId) {
  return apiRequest(withQuery('/api/dashboard', { companyId }), { token });
}

export async function getNotifications(token, companyId) {
  return apiRequest(withQuery('/api/notifications', { companyId }), { token });
}

export async function getAudit(token, companyId) {
  return apiRequest(withQuery('/api/audit', { companyId }), { token });
}

// Empresas y sucursales
export async function listCompanies(token) {
  return apiRequest('/api/companies', { token });
}

export async function getCompany(token, companyId) {
  return apiRequest(`/api/companies/${encodeURIComponent(companyId)}`, { token });
}

export async function listBranches(token, companyId) {
  return apiRequest(withQuery('/api/branches', { companyId }), { token });
}

// Catálogo e inventario
export async function listCategories(token, companyId) {
  return apiRequest(withQuery('/api/categories', { companyId }), { token });
}

export async function listProducts(token, companyId, limit = 100) {
  return apiRequest(
    withQuery('/api/products', { companyId, page: 1, limit }),
    { token }
  );
}

export async function listWarehouses(token, companyId) {
  return apiRequest(withQuery('/api/warehouses', { companyId }), { token });
}

export async function listInventory(token, companyId) {
  return apiRequest(withQuery('/api/inventory', { companyId }), { token });
}

export async function listInventoryMovements(token, companyId) {
  return apiRequest(
    withQuery('/api/inventory/movements', { companyId }),
    { token }
  );
}

// Ventas y compras
export async function listSales(token, companyId) {
  return apiRequest(withQuery('/api/sales', { companyId }), { token });
}

export async function listPurchases(token, companyId) {
  return apiRequest(withQuery('/api/purchases', { companyId }), { token });
}

// Personas
export async function listCustomers(token, companyId, limit = 100) {
  return apiRequest(
    withQuery('/api/customers', { companyId, page: 1, limit }),
    { token }
  );
}

export async function listSuppliers(token, companyId) {
  return apiRequest(withQuery('/api/suppliers', { companyId }), { token });
}

export async function listEmployees(token, companyId) {
  return apiRequest(withQuery('/api/employees', { companyId }), { token });
}

export async function listDepartments(token, companyId) {
  return apiRequest(withQuery('/api/departments', { companyId }), { token });
}

export async function listLeads(token, companyId) {
  return apiRequest(withQuery('/api/leads', { companyId }), { token });
}

export async function listOpportunities(token, companyId) {
  return apiRequest(withQuery('/api/opportunities', { companyId }), { token });
}

export async function listProjects(token, companyId) {
  return apiRequest(withQuery('/api/projects', { companyId }), { token });
}

export async function listTasks(token, companyId) {
  return apiRequest(withQuery('/api/tasks', { companyId }), { token });
}

// Finanzas
export async function listIncomeRecords(token, companyId) {
  return apiRequest(
    withQuery('/api/finance/incomes', { companyId }),
    { token }
  );
}

export async function listExpenseRecords(token, companyId) {
  return apiRequest(
    withQuery('/api/finance/expenses', { companyId }),
    { token }
  );
}

export async function listPayments(token, companyId) {
  return apiRequest(
    withQuery('/api/finance/payments', { companyId }),
    { token }
  );
}