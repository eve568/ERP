import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireFields } from '../utils/validation.js';
import { sendSuccess } from '../utils/response.js';
import { createCategory, createProduct, listCategories, listProducts, updateCategory, updateProduct } from '../modules/catalog/catalog.service.js';

const router = Router();
router.use(requireAuth);

router.post('/categories', authorizePermission('CREATE'), asyncHandler(async (request, response) => {
  requireFields(request.body, ['name']);
  return sendSuccess(response, await createCategory(request.body, request.user), 'Categoría creada correctamente', 201);
}));
router.get('/categories', authorizePermission('VIEW'), asyncHandler(async (request, response) => sendSuccess(response, await listCategories(request.query, request.user))));
router.put('/categories/:id', authorizePermission('UPDATE'), asyncHandler(async (request, response) => (
  sendSuccess(response, await updateCategory(request.params.id, request.body, request.user), 'Categoría actualizada correctamente')
)));

router.post('/products', authorizePermission('CREATE'), asyncHandler(async (request, response) => {
  requireFields(request.body, ['sku', 'name', 'categoryId', 'purchasePrice', 'salePrice', 'unit']);
  return sendSuccess(response, await createProduct(request.body, request.user), 'Producto creado correctamente', 201);
}));
router.get('/products', authorizePermission('VIEW'), asyncHandler(async (request, response) => sendSuccess(response, await listProducts(request.query, request.user))));
router.put('/products/:id', authorizePermission('UPDATE'), asyncHandler(async (request, response) => (
  sendSuccess(response, await updateProduct(request.params.id, request.body, request.user), 'Producto actualizado correctamente')
)));

export default router;
