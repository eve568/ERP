import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Branch } from '../src/models/branch.model.js';
import { Inventory } from '../src/models/inventory.model.js';
import { InventoryMovement } from '../src/models/inventory-movement.model.js';
import { Product } from '../src/models/product.model.js';
import { Warehouse } from '../src/models/warehouse.model.js';
import { createMovement } from '../src/modules/inventory/inventory.service.js';

env.jwtSecret = 'test-secret-only';
const server = createApp().listen(0);
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const token = jwt.sign({ sub: 'test-user', role: 'ALMACEN', companyId: '507f1f77bcf86cd799439011' }, env.jwtSecret);
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

test.after(() => server.close());

test('Inventario requiere autenticación', async () => {
  const response = await fetch(`${baseUrl}/api/inventory`);
  assert.equal(response.status, 401);
});

test('Movimiento de inventario valida campos mínimos', async () => {
  const response = await fetch(`${baseUrl}/api/inventory/movement`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'PURCHASE' })
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body.details.missingFields, ['productId', 'warehouseId', 'quantity']);
});

test('Crear almacén no simula persistencia sin MongoDB', async () => {
  const response = await fetch(`${baseUrl}/api/warehouses`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Almacén Demo', branchId: '507f1f77bcf86cd799439012' })
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.message, 'El servicio de inventario no está disponible');
});

test('Los modelos de inventario tienen índices de trazabilidad', () => {
  assert.equal(Warehouse.schema.indexes().some(([fields, options]) => fields.companyId === 1 && fields.name === 1 && options.unique), true);
  assert.equal(Inventory.schema.indexes().some(([fields, options]) => fields.warehouseId === 1 && fields.productId === 1 && options.unique), true);
  assert.equal(InventoryMovement.schema.indexes().some(([fields]) => fields.companyId === 1 && fields.createdAt === -1), true);
});

const companyA = '507f1f77bcf86cd799439011';
const companyB = '507f1f77bcf86cd799439012';
const branchA = '507f1f77bcf86cd799439013';
const branchB = '507f1f77bcf86cd799439014';
const warehouseA = '507f1f77bcf86cd799439015';
const warehouseB = '507f1f77bcf86cd799439016';
const productA = '507f1f77bcf86cd799439017';
const productB = '507f1f77bcf86cd799439018';
const movementUserId = '507f1f77bcf86cd799439019';

async function withInventoryMocks({
  activeCompanyId = companyA,
  warehouseCompanyId = companyA,
  selectedWarehouseId = warehouseA,
  warehouseBranchId = branchA,
  warehouseBranchStatus = 'ACTIVE',
  userCompanyId = companyA,
  userBranchId,
  productCompanyId = companyA,
  currentQuantity = 0,
  quantity = 5,
  type = 'PURCHASE',
  role = 'ADMIN',
  shouldFailMovement = false,
  run,
}) {
  const models = [
    [Warehouse, 'findById'],
    [Branch, 'findOne'],
    [Product, 'findOne'],
    [Inventory, 'findOne'],
    [Inventory, 'findOneAndUpdate'],
    [InventoryMovement, 'create'],
  ];
  const originals = models.map(([Model, method]) => [Model, method, Model[method]]);
  const originalStartSession = mongoose.startSession;
  let updateQuery;
  let updateDocument;
  let movementDocument;

  mongoose.connection.emit('connected');
  Warehouse.findById = () => ({
    lean: async () => ({
      _id: selectedWarehouseId,
      companyId: warehouseCompanyId,
      branchId: warehouseBranchId,
      status: 'ACTIVE',
    }),
  });
  Branch.findOne = () => ({
    lean: async () => ({
      _id: warehouseBranchId,
      companyId: warehouseCompanyId,
      status: warehouseBranchStatus,
    }),
  });
  Product.findOne = (filter) => ({
    lean: async () =>
      filter.companyId === productCompanyId
        ? {
            _id: filter._id,
            companyId: productCompanyId,
            minimumStock: 2,
            maximumStock: 100,
          }
        : null,
  });
  Inventory.findOne = () => ({
    session: async () =>
      currentQuantity === null ? null : { quantity: currentQuantity },
  });
  Inventory.findOneAndUpdate = async (filter, update) => {
    updateQuery = filter;
    updateDocument = update;
  };
  InventoryMovement.create = async ([movement]) => {
    if (shouldFailMovement) throw new Error('movement insert failed');
    movementDocument = movement;
    return [movement];
  };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });

  try {
    return await run({
      payload: {
        companyId: activeCompanyId,
        warehouseId: selectedWarehouseId,
        productId: productA,
        type,
        quantity,
        reason: 'Prueba',
      },
      user: {
        sub: movementUserId,
        role,
        companyId: userCompanyId,
        branchId: userBranchId,
      },
      getUpdate: () => ({ query: updateQuery, document: updateDocument }),
      getMovement: () => movementDocument,
      otherCompanyId: companyB,
      otherBranchId: branchB,
      otherWarehouseId: warehouseB,
      otherProductId: productB,
    });
  } finally {
    for (const [Model, method, original] of originals) Model[method] = original;
    mongoose.startSession = originalStartSession;
    mongoose.connection.emit('disconnected');
  }
}

test('Una entrada PURCHASE incrementa Inventory y registra el movimiento atómicamente', async () => {
  await withInventoryMocks({
    currentQuantity: 3,
    quantity: 5,
    run: async ({ payload, user, getUpdate, getMovement }) => {
      await createMovement(payload, user);
      assert.equal(getUpdate().document.$set.quantity, 8);
      assert.equal(getUpdate().document.$set.minimumStock, 2);
      assert.equal(getMovement().type, 'PURCHASE');
      assert.equal(getMovement().quantity, 5);
      assert.equal(getMovement().userId, movementUserId);
    },
  });
});

test('Una salida SALE descuenta existencias y rechaza stock insuficiente', async () => {
  await withInventoryMocks({
    currentQuantity: 8,
    type: 'SALE',
    quantity: 3,
    run: async ({ payload, user, getUpdate, getMovement }) => {
      await createMovement(payload, user);
      assert.equal(getUpdate().document.$set.quantity, 5);
      assert.equal(getMovement().type, 'SALE');
      assert.equal(getMovement().quantity, 3);
    },
  });

  await withInventoryMocks({
    currentQuantity: 2,
    type: 'SALE',
    quantity: 3,
    run: async ({ payload, user, getUpdate, getMovement }) => {
      await assert.rejects(
        createMovement(payload, user),
        (error) => error.statusCode === 409
      );
      assert.equal(getUpdate().document, undefined);
      assert.equal(getMovement(), undefined);
    },
  });
});

test('ADJUSTMENT registra una diferencia firmada y nunca permite stock negativo', async () => {
  await withInventoryMocks({
    currentQuantity: 10,
    type: 'ADJUSTMENT',
    quantity: -4,
    run: async ({ payload, user, getUpdate, getMovement }) => {
      await createMovement(payload, user);
      assert.equal(getUpdate().document.$set.quantity, 6);
      assert.equal(getMovement().quantity, -4);
    },
  });

  await withInventoryMocks({
    currentQuantity: 2,
    type: 'ADJUSTMENT',
    quantity: -3,
    run: async ({ payload, user, getUpdate, getMovement }) => {
      await assert.rejects(
        createMovement(payload, user),
        (error) => error.statusCode === 409
      );
      assert.equal(getUpdate().document, undefined);
      assert.equal(getMovement(), undefined);
    },
  });
});

test('ADMIN no puede mover inventario ni usar productos de otra empresa', async () => {
  await withInventoryMocks({
    warehouseCompanyId: companyB,
    selectedWarehouseId: warehouseB,
    warehouseBranchId: branchB,
    run: async ({ payload, user }) => {
      await assert.rejects(
        createMovement(payload, user),
        (error) => error.statusCode === 403
      );
    },
  });

  await withInventoryMocks({
    productCompanyId: companyB,
    run: async ({ payload, user }) => {
      await assert.rejects(
        createMovement(payload, user),
        (error) => error.statusCode === 404
      );
    },
  });
});

test('Usuario normal no puede usar almacén de otra empresa o sucursal', async () => {
  await withInventoryMocks({
    role: 'ALMACEN',
    userBranchId: branchA,
    warehouseCompanyId: companyB,
    selectedWarehouseId: warehouseB,
    warehouseBranchId: branchB,
    run: async ({ payload, user }) => {
      await assert.rejects(
        createMovement(payload, user),
        (error) => error.statusCode === 403
      );
    },
  });

  await withInventoryMocks({
    role: 'ALMACEN',
    userBranchId: branchA,
    warehouseBranchId: branchB,
    run: async ({ payload, user }) => {
      await assert.rejects(
        createMovement(payload, user),
        (error) => error.statusCode === 403
      );
    },
  });
});

test('No permite movimientos en sucursales inactivas', async () => {
  await withInventoryMocks({
    warehouseBranchStatus: 'INACTIVE',
    run: async ({ payload, user }) => {
      await assert.rejects(
        createMovement(payload, user),
        (error) => error.statusCode === 409
      );
    },
  });
});

test('No registra movimiento si falla su inserción transaccional', async () => {
  await withInventoryMocks({
    currentQuantity: 4,
    shouldFailMovement: true,
    run: async ({ payload, user }) => {
      await assert.rejects(
        createMovement(payload, user),
        /movement insert failed/
      );
    },
  });
});
