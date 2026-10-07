import { loadSession } from './session';

const apiUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (typeof window !== 'undefined'
    ? 'https://erp-backend-7xai.onrender.com'
    : 'http://localhost:4000');

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

function withCompanyId(path, companyId) {
  const [pathname, query = ''] = path.split('?');
  const params = query
    .split('&')
    .filter(
      (parameter) =>
        parameter && parameter.split('=', 1)[0] !== 'companyId'
    );
  params.push(`companyId=${encodeURIComponent(String(companyId))}`);
  return `${pathname}?${params.join('&')}`;
}

function withoutCompanyId(path) {
  const [pathname, query = ''] = path.split('?');
  const params = query
    .split('&')
    .filter(
      (parameter) =>
        parameter && parameter.split('=', 1)[0] !== 'companyId'
    );
  return params.length ? `${pathname}?${params.join('&')}` : pathname;
}

function withCompanyIdInBody(body, companyId) {
  if (typeof body !== 'string') return body;

  try {
    const payload = JSON.parse(body);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return body;
    }
    return JSON.stringify({ ...payload, companyId });
  } catch {
    return body;
  }
}

function withoutCompanyIdInBody(body) {
  if (typeof body !== 'string') return body;

  try {
    const payload = JSON.parse(body);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return body;
    }
    delete payload.companyId;
    return JSON.stringify(payload);
  } catch {
    return body;
  }
}

export async function apiRequest(path, options = {}) {
  const { token, headers: customHeaders, ...requestOptions } = options;
  const session = loadSession();
  const sessionCompanyId =
    session?.user?.role === 'ADMIN'
      ? session.activeCompanyId
      : session?.user?.companyId;
  const companyId =
    sessionCompanyId && typeof sessionCompanyId === 'object'
      ? sessionCompanyId._id ?? sessionCompanyId.id
      : sessionCompanyId;
  const companyScoped =
    path.startsWith('/api/') &&
    !path.startsWith('/api/auth/') &&
    !path.startsWith('/api/health') &&
    !path.startsWith('/api/companies');

  if (companyScoped && companyId) {
    if (requestOptions.body !== undefined && requestOptions.body !== null) {
      requestOptions.body = withCompanyIdInBody(requestOptions.body, companyId);
    } else {
      path = withCompanyId(path, companyId);
    }
  } else if (companyScoped) {
    path = withoutCompanyId(path);
    requestOptions.body = withoutCompanyIdInBody(requestOptions.body);
  }

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

function normalizeProductListOptions(options) {
  return typeof options === 'number' ? { limit: options } : options ?? {};
}

export async function listProducts(token, companyId, options = {}) {
  const { page = 1, limit = 100, q, status, categoryId } =
    normalizeProductListOptions(options);
  return apiRequest(
    withQuery('/api/products', { companyId, page, limit, q, status, categoryId }),
    { token }
  );
}

function normalizeListOptions(options) {
  return typeof options === 'string' ? { branchId: options } : options ?? {};
}

export async function listWarehouses(token, companyId, options = {}) {
  const { branchId, status } = normalizeListOptions(options);
  return apiRequest(
    withQuery('/api/warehouses', { companyId, branchId, status }),
    { token }
  );
}

export async function listInventory(token, companyId, options = {}) {
  const { warehouseId, branchId, productId, q } =
    normalizeListOptions(options);
  return apiRequest(
    withQuery('/api/inventory', {
      companyId,
      warehouseId,
      branchId,
      productId,
      q,
    }),
    { token }
  );
}

export async function listInventoryMovements(token, companyId, options = {}) {
  const { warehouseId, branchId, productId, q, type, limit } =
    normalizeListOptions(options);
  return apiRequest(
    withQuery('/api/inventory/movements', {
      companyId,
      warehouseId,
      branchId,
      productId,
      q,
      type,
      limit,
    }),
    { token }
  );
}

// Ventas y compras
export async function listSales(token, companyId, options = {}) {
  const { status, q, limit } = options;
  return apiRequest(
    withQuery('/api/sales', { companyId, status, q, limit }),
    { token }
  );
}

export async function getSale(token, companyId, saleId) {
  return apiRequest(
    withQuery(`/api/sales/${encodeURIComponent(saleId)}`, { companyId }),
    { token }
  );
}

export async function listPurchases(token, companyId, options = {}) {
  const { status, q, limit } = options;
  return apiRequest(
    withQuery('/api/purchases', { companyId, status, q, limit }),
    { token }
  );
}

export async function getPurchase(token, companyId, purchaseId) {
  return apiRequest(
    withQuery(`/api/purchases/${encodeURIComponent(purchaseId)}`, {
      companyId,
    }),
    { token }
  );
}

// Personas
function normalizePartnerListOptions(options) {
  return typeof options === 'number' ? { limit: options } : options ?? {};
}

export async function listCustomers(token, companyId, options = {}) {
  const { page = 1, limit = 100, q, status } =
    normalizePartnerListOptions(options);
  return apiRequest(
    withQuery('/api/customers', { companyId, page, limit, q, status }),
    { token }
  );
}

export async function listSuppliers(token, companyId, options = {}) {
  const { page = 1, limit = 100, q, status } =
    normalizePartnerListOptions(options);
  return apiRequest(
    withQuery('/api/suppliers', { companyId, page, limit, q, status }),
    { token }
  );
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

export async function sendTestEmail(token, to) {
  return apiRequest('/api/email/test', {
    method: 'POST',
    token,
    body: JSON.stringify({ to }),
  });
}
