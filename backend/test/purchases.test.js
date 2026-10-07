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
import { Purchase } from '../src/models/purchase.model.js';
import { Supplier } from '../src/models/supplier.model.js';
import { Warehouse } from '../src/models/warehouse.model.js';
import {
  createPurchase,
  getPurchase,
  receivePurchase,
} from '../src/modules/purchases/purchase.service.js';

env.jwtSecret = 'test-secret-only';
const server = createApp().listen(0);
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const token = jwt.sign({ sub: '507f1f77bcf86cd799439013', role: 'COMPRAS', companyId: '507f1f77bcf86cd799439011' }, env.jwtSecret);
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

test.after(() => server.close());

test('Compras requiere autenticación', async () => {
  const response = await fetch(`${baseUrl}/api/purchases`);
  assert.equal(response.status, 401);
});

test('Crear compra valida campos mínimos', async () => {
  const response = await fetch(`${baseUrl}/api/purchases`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body.details.missingFields, ['supplierId', 'items']);
});

test('Recibir compra exige almacén', async () => {
  const response = await fetch(`${baseUrl}/api/purchases/507f1f77bcf86cd799439014/receive`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body.details.missingFields, ['warehouseId']);
});

test('Modo de pruebas permite CREATE de compras a EMPLEADO', async () => {
  const employeeToken = jwt.sign(
    {
      sub: '507f1f77bcf86cd799439013',
      role: 'EMPLEADO',
      companyId: '507f1f77bcf86cd799439011',
    },
    env.jwtSecret
  );
  const response = await fetch(`${baseUrl}/api/purchases`, {
    method: 'POST',
    headers: new Headers({
      'content-type': 'application/json',
      authorization: ['Bearer', employeeToken].join(' '),
    }),
    body: JSON.stringify({ supplierId: '507f1f77bcf86cd799439015', items: [{}] }),
  });
  assert.notEqual(response.status, 403);
});

test('El modelo de compra incluye recepción y trazabilidad', () => {
  assert.equal(Purchase.schema.path('status').enumValues.includes('RECEIVED'), true);
  assert.equal(Purchase.schema.path('supplierId').options.required, true);
  assert.equal(Purchase.schema.indexes().some(([fields]) => fields.companyId === 1 && fields.createdAt === -1), true);
  assert.equal(Purchase.schema.path('warehouseId').options.ref, 'Warehouse');
});

const companyA = '507f1f77bcf86cd799439011';
const companyB = '507f1f77bcf86cd799439012';
const branchA = '507f1f77bcf86cd799439013';
const warehouseA = '507f1f77bcf86cd799439014';
const warehouseB = '507f1f77bcf86cd799439020';
const supplierA = '507f1f77bcf86cd799439015';
const productA = '507f1f77bcf86cd799439016';
const productB = '507f1f77bcf86cd799439017';
const purchaseId = '507f1f77bcf86cd799439018';
const userId = '507f1f77bcf86cd799439019';

function queryWith(value) {
  return {
    session() {
      return this;
    },
    lean: async () => value,
  };
}

async function withPurchaseMocks({
  supplierCompany = companyA,
  productCompanies = {},
  warehouseCompany = companyA,
  selectedWarehouse = warehouseA,
  selectedBranch = branchA,
  branchStatus = 'ACTIVE',
  role = 'ADMIN',
  userCompany = companyA,
  userBranch,
  initialQuantities = {},
  failMovement = false,
  draft = null,
  rollback = true,
  run,
}) {
  const patched = [
    [Supplier, 'findOne'],
    [Product, 'findOne'],
    [Warehouse, 'findOne'],
    [Branch, 'findOne'],
    [Inventory, 'findOneAndUpdate'],
    [InventoryMovement, 'create'],
    [Purchase, 'create'],
  ];
  const originals = patched.map(([Model, method]) => [Model, method, Model[method]]);
  const originalPurchaseFindOne = Purchase.findOne;
  const originalStartSession = mongoose.startSession;
  const originalDatabaseState = mongoose.connection.readyState;
  const state = {
    quantities: { ...initialQuantities },
    inventoryKeys: new Set(Object.keys(initialQuantities)),
    movements: [],
    purchases: [],
    serial: 0,
    inventoryConditions: [],
  };
  let transactionQueue = Promise.resolve();
  let testDraft;

  mongoose.connection.emit('connected');
  Supplier.findOne = (filter) =>
    queryWith(
      filter._id === supplierA && filter.companyId === supplierCompany
        ? { _id: supplierA, companyId: supplierCompany, status: 'ACTIVE' }
        : null
    );
  Product.findOne = (filter) => {
    const actualCompany = productCompanies[filter._id] ?? companyA;
    return queryWith(
      filter.companyId === actualCompany
        ? {
            _id: filter._id,
            companyId: actualCompany,
            status: 'ACTIVE',
            purchasePrice: filter._id === productA ? 7 : 12,
          }
        : null
    );
  };
  Warehouse.findOne = (filter) =>
    queryWith(
      filter._id === selectedWarehouse && filter.companyId === warehouseCompany
        ? {
            _id: selectedWarehouse,
            companyId: warehouseCompany,
            branchId: selectedBranch,
            status: 'ACTIVE',
          }
        : null
    );
  Branch.findOne = () =>
    queryWith({
      _id: selectedBranch,
      companyId: warehouseCompany,
      status: branchStatus,
    });
  Inventory.findOneAndUpdate = async (filter, update) => {
    state.inventoryConditions.push(filter);
    const key = `${filter.companyId}:${filter.warehouseId}:${filter.productId}`;
    if (!state.inventoryKeys.has(key)) state.inventoryKeys.add(key);
    state.quantities[key] = (state.quantities[key] ?? 0) + update.$inc.quantity;
    return { quantity: state.quantities[key] };
  };
  InventoryMovement.create = async (documents) => {
    if (failMovement) throw new Error('movement insert failed');
    state.movements.push(...documents);
    return documents;
  };
  Purchase.create = async (documents) => {
    const created = documents.map((document) => {
      state.serial += 1;
      return {
        ...document,
        _id: (BigInt(`0x${purchaseId}`) + BigInt(state.serial))
          .toString(16)
          .padStart(24, '0'),
      };
    });
    state.purchases.push(...created);
    return created;
  };
  Purchase.findOne = (filter) => ({
    session: async () =>
      testDraft &&
      filter._id === purchaseId &&
      filter.companyId === testDraft.companyId
        ? testDraft
        : null,
  });
  mongoose.startSession = async () => ({
    withTransaction: (callback) => {
      const transaction = transactionQueue.then(async () => {
        const quantitySnapshot = { ...state.quantities };
        const inventoryKeysSnapshot = new Set(state.inventoryKeys);
        const movementCount = state.movements.length;
        const purchaseCount = state.purchases.length;
        try {
          await callback();
        } catch (error) {
          if (rollback) {
            state.quantities = quantitySnapshot;
            state.inventoryKeys = inventoryKeysSnapshot;
            state.movements.length = movementCount;
            state.purchases.length = purchaseCount;
          }
          throw error;
        }
      });
      transactionQueue = transaction.catch(() => {});
      return transaction;
    },
    endSession: async () => {},
  });

  testDraft = draft ?? {
    _id: purchaseId,
    companyId: companyA,
    supplierId: supplierA,
    userId,
    items: [{ productId: productA, quantity: 2, price: 9, subtotal: 18 }],
    subtotal: 18,
    tax: 0,
    discount: 0,
    total: 18,
    status: 'DRAFT',
    async save() {
      return this;
    },
  };

  try {
    await run({
      state,
      companyA,
      companyB,
      branchA,
      warehouseA,
      warehouseB,
      supplierA,
      productA,
      productB,
      purchaseId,
      user: {
        sub: userId,
        role,
        companyId: userCompany,
        branchId: userBranch,
      },
      payload: {
        companyId: companyA,
        supplierId: supplierA,
        warehouseId: warehouseA,
        items: [
          { productId: productA, quantity: 10, price: 9 },
          { productId: productB, quantity: 2, price: 15 },
        ],
      },
      draft: testDraft,
    });
  } finally {
    for (const [Model, method, original] of originals) Model[method] = original;
    Purchase.findOne = originalPurchaseFindOne;
    mongoose.startSession = originalStartSession;
    if (originalDatabaseState === 0) mongoose.connection.emit('disconnected');
  }
}

test('Compra recibida calcula costos ingresados y suma varios productos', async () => {
  await withPurchaseMocks({
    run: async ({ payload, user, state, productA, productB }) => {
      const purchase = await createPurchase(
        {
          ...payload,
          total: 1,
          subtotal: 0,
          tax: 100,
          discount: 90,
        },
        user
      );
      assert.equal(purchase.status, 'RECEIVED');
      assert.equal(purchase.subtotal, 120);
      assert.equal(purchase.total, 120);
      assert.equal(purchase.items[0].price, 9);
      assert.equal(purchase.items[1].price, 15);
      assert.equal(
        state.quantities[`${companyA}:${warehouseA}:${productA}`],
        10
      );
      assert.equal(
        state.quantities[`${companyA}:${warehouseA}:${productB}`],
        2
      );
      assert.equal(state.inventoryKeys.size, 2);
      assert.equal(state.movements.length, 2);
      assert.ok(state.movements.every((movement) => movement.type === 'PURCHASE'));
      assert.ok(
        state.movements.every(
          (movement) => String(movement.referenceId) === String(purchase._id)
        )
      );
    },
  });
});

test('Costo omitido usa Product.purchasePrice como referencia y conserva el modelo', async () => {
  await withPurchaseMocks({
    run: async ({ payload, user }) => {
      const purchase = await createPurchase(
        {
          ...payload,
          items: [{ productId: productA, quantity: 2 }],
        },
        user
      );
      assert.equal(purchase.items[0].price, 7);
      assert.equal(purchase.total, 14);
    },
  });
});

test('Rechaza proveedor de otra empresa', async () => {
  await withPurchaseMocks({
    supplierCompany: companyB,
    run: async ({ payload, user, state }) => {
      await assert.rejects(
        createPurchase(payload, user),
        (error) => error.statusCode === 404
      );
      assert.equal(state.purchases.length, 0);
    },
  });
});

test('Rechaza producto de otra empresa', async () => {
  await withPurchaseMocks({
    productCompanies: { [productA]: companyB },
    run: async ({ payload, user, state }) => {
      await assert.rejects(
        createPurchase(payload, user),
        (error) => error.statusCode === 404
      );
      assert.equal(state.purchases.length, 0);
    },
  });
});

test('Rechaza almacén de otra empresa y sucursal no permitida', async () => {
  await withPurchaseMocks({
    warehouseCompany: companyB,
    selectedWarehouse: warehouseB,
    selectedBranch: '507f1f77bcf86cd799439021',
    run: async ({ payload, user, state, warehouseB }) => {
      await assert.rejects(
        createPurchase({ ...payload, warehouseId: warehouseB }, user),
        (error) => error.statusCode === 404
      );
      assert.equal(state.purchases.length, 0);
    },
  });
  await withPurchaseMocks({
    branchStatus: 'INACTIVE',
    run: async ({ payload, user, state }) => {
      await assert.rejects(
        createPurchase(payload, user),
        (error) => error.statusCode === 409
      );
      assert.equal(state.purchases.length, 0);
    },
  });
  await withPurchaseMocks({
    role: 'COMPRAS',
    userBranch: branchA,
    selectedBranch: '507f1f77bcf86cd799439021',
    run: async ({ payload, user, state }) => {
      await assert.rejects(
        createPurchase(payload, user),
        (error) => error.statusCode === 403
      );
      assert.equal(state.purchases.length, 0);
    },
  });
});

test('Rechaza cantidad y costo inválidos y no acepta totales enviados por cliente', async () => {
  await withPurchaseMocks({
    run: async ({ payload, user, state }) => {
      await assert.rejects(
        createPurchase(
          {
            ...payload,
            items: [{ productId: productA, quantity: 0, price: 9 }],
          },
          user
        ),
        (error) => error.statusCode === 400
      );
      await assert.rejects(
        createPurchase(
          {
            ...payload,
            items: [{ productId: productA, quantity: 1, price: -2 }],
          },
          user
        ),
        (error) => error.statusCode === 400
      );
      const purchase = await createPurchase(
        {
          ...payload,
          items: [{ productId: productA, quantity: 3, price: 4 }],
          total: 1,
          subtotal: 0,
          tax: 50,
          discount: 40,
        },
        user
      );
      assert.equal(purchase.subtotal, 12);
      assert.equal(purchase.total, 12);
      assert.equal(state.purchases.length, 1);
    },
  });
});

test('Rollback transaccional revierte compra y existencia si falla movimiento', async () => {
  await withPurchaseMocks({
    failMovement: true,
    run: async ({ payload, user, state }) => {
      await assert.rejects(createPurchase(payload, user), /movement insert failed/);
      assert.equal(state.purchases.length, 0);
      assert.equal(state.movements.length, 0);
      assert.deepEqual(state.quantities, {});
      assert.equal(state.inventoryKeys.size, 0);
    },
  });
});

test('Compras concurrentes incrementan la fila Inventory sin perder cantidades', async () => {
  await withPurchaseMocks({
    run: async ({ payload, user, state, productA }) => {
      const first = {
        ...payload,
        items: [{ productId: productA, quantity: 10, price: 8 }],
      };
      const second = {
        ...payload,
        items: [{ productId: productA, quantity: 5, price: 8 }],
      };
      await Promise.all([
        createPurchase(first, user),
        createPurchase(second, user),
      ]);
      assert.equal(
        state.quantities[`${companyA}:${warehouseA}:${productA}`],
        15
      );
      assert.equal(state.inventoryKeys.size, 1);
      assert.equal(state.movements.length, 2);
      assert.equal(state.purchases.length, 2);
    },
  });
});

test('No permite consultar ni recibir una compra de otra empresa', async () => {
  await withPurchaseMocks({
    draft: {
      _id: purchaseId,
      companyId: companyB,
      supplierId: supplierA,
      items: [{ productId: productA, quantity: 2, price: 9, subtotal: 18 }],
      status: 'DRAFT',
      async save() {
        return this;
      },
    },
    run: async ({ user, warehouseA }) => {
      await assert.rejects(
        receivePurchase(purchaseId, warehouseA, companyA, user),
        (error) => error.statusCode === 404
      );
    },
  });

  const originalFindOne = Purchase.findOne;
  mongoose.connection.emit('connected');
  Purchase.findOne = (filter) => ({
    populate() {
      return this;
    },
    lean: async () =>
      filter.companyId === companyA
        ? { _id: purchaseId, companyId: companyA }
        : null,
  });
  try {
    await assert.rejects(
      getPurchase(purchaseId, { companyId: companyB }, { role: 'ADMIN' }),
      (error) => error.statusCode === 404
    );
  } finally {
    Purchase.findOne = originalFindOne;
    mongoose.connection.emit('disconnected');
  }
});

test('Recibe una compra borrador antigua en transacción y la liga al almacén', async () => {
  await withPurchaseMocks({
    run: async ({ user, warehouseA, companyA, state, draft }) => {
      const purchase = await receivePurchase(
        purchaseId,
        warehouseA,
        companyA,
        user
      );
      assert.equal(purchase.status, 'RECEIVED');
      assert.equal(purchase.warehouseId, warehouseA);
      assert.equal(purchase.total, 18);
      assert.equal(state.quantities[`${companyA}:${warehouseA}:${productA}`], 2);
      assert.equal(state.movements.length, 1);
      assert.equal(state.movements[0].type, 'PURCHASE');
      assert.equal(String(state.movements[0].referenceId), purchaseId);
      assert.equal(draft.status, 'RECEIVED');
    },
  });
});
