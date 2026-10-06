import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Branch } from '../src/models/branch.model.js';
import { Customer } from '../src/models/customer.model.js';
import { Inventory } from '../src/models/inventory.model.js';
import { InventoryMovement } from '../src/models/inventory-movement.model.js';
import { Product } from '../src/models/product.model.js';
import { Sale } from '../src/models/sale.model.js';
import { Warehouse } from '../src/models/warehouse.model.js';
import {
  confirmSale,
  createSale,
} from '../src/modules/sales/sale.service.js';

env.jwtSecret = 'test-secret-only';
const server = createApp().listen(0);
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const token = jwt.sign({ sub: '507f1f77bcf86cd799439013', role: 'VENTAS', companyId: '507f1f77bcf86cd799439011' }, env.jwtSecret);
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

test.after(() => server.close());

test('Ventas requiere autenticación', async () => {
  const response = await fetch(`${baseUrl}/api/sales`);
  assert.equal(response.status, 401);
});

test('Crear venta valida campos mínimos', async () => {
  const response = await fetch(`${baseUrl}/api/sales`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ paymentMethod: 'CASH' })
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body.details.missingFields, ['customerId', 'items']);
});

test('Confirmar venta exige almacén', async () => {
  const response = await fetch(`${baseUrl}/api/sales/507f1f77bcf86cd799439014/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body.details.missingFields, ['warehouseId']);
});

test('El modelo de venta contiene estados y trazabilidad', () => {
  assert.equal(Sale.schema.path('status').enumValues.includes('CONFIRMED'), true);
  assert.equal(Sale.schema.path('userId').options.required, true);
  assert.equal(Sale.schema.indexes().some(([fields]) => fields.companyId === 1 && fields.createdAt === -1), true);
  assert.equal(Sale.schema.path('warehouseId').options.ref, 'Warehouse');
});

const companyA = '507f1f77bcf86cd799439011';
const companyB = '507f1f77bcf86cd799439012';
const branchA = '507f1f77bcf86cd799439013';
const warehouseA = '507f1f77bcf86cd799439014';
const warehouseB = '507f1f77bcf86cd799439020';
const customerA = '507f1f77bcf86cd799439015';
const productA = '507f1f77bcf86cd799439016';
const productB = '507f1f77bcf86cd799439017';
const saleId = '507f1f77bcf86cd799439018';
const userId = '507f1f77bcf86cd799439019';

function queryWith(value) {
  return {
    select() {
      return this;
    },
    session() {
      return this;
    },
    lean: async () => value,
  };
}

async function withSalesMocks({
  stocks = { [productA]: 10, [productB]: 10 },
  customerCompany = companyA,
  productCompanies = {},
  warehouseCompany = companyA,
  selectedWarehouse = warehouseA,
  selectedWarehouseBranch = branchA,
  role = 'ADMIN',
  userCompany = companyA,
  userBranch,
  branchStatus = 'ACTIVE',
  draftCompany = companyA,
  includeDraft = false,
  failMovement = false,
  rollback = true,
  run,
}) {
  const patched = [
    [Customer, 'findOne'],
    [Product, 'findOne'],
    [Warehouse, 'findOne'],
    [Branch, 'findOne'],
    [Inventory, 'findOneAndUpdate'],
    [InventoryMovement, 'create'],
    [Sale, 'create'],
  ];
  const originals = patched.map(([Model, method]) => [Model, method, Model[method]]);
  const originalStartSession = mongoose.startSession;
  const originalDatabaseState = mongoose.connection.readyState;
  const state = {
    stocks: { ...stocks },
    movements: [],
    sales: [],
    inventoryConditions: [],
    serial: 0,
  };
  const draft = includeDraft
    ? {
        _id: saleId,
        companyId: draftCompany,
        customerId: customerA,
        userId,
        items: [{ productId: productA, quantity: 2, price: 1, subtotal: 2 }],
        subtotal: 2,
        tax: 0,
        discount: 0,
        total: 2,
        paymentMethod: 'CASH',
        status: 'DRAFT',
        async save() {
          return this;
        },
      }
    : null;
  if (draft) state.sales.push(draft);
  let transactionQueue = Promise.resolve();

  mongoose.connection.emit('connected');
  Customer.findOne = (filter) =>
    queryWith(
      filter._id === customerA && filter.companyId === customerCompany
        ? { _id: customerA, companyId: customerCompany, status: 'ACTIVE' }
        : null
    );
  Product.findOne = (filter) => {
    const productCompany = productCompanies[filter._id] ?? companyA;
    return queryWith(
      filter.companyId === productCompany
        ? {
            _id: filter._id,
            companyId: productCompany,
            status: 'ACTIVE',
            salePrice: filter._id === productA ? 10 : 25,
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
            branchId: selectedWarehouseBranch,
            status: 'ACTIVE',
          }
        : null
    );
  Branch.findOne = () =>
    queryWith({
      _id: selectedWarehouseBranch,
      companyId: warehouseCompany,
      status: branchStatus,
    });
  Inventory.findOneAndUpdate = async (filter, update) => {
    state.inventoryConditions.push(filter);
    const key = String(filter.productId);
    const current = state.stocks[key] ?? 0;
    if (current < filter.quantity.$gte) return null;
    state.stocks[key] = current + update.$inc.quantity;
    return { quantity: state.stocks[key] };
  };
  InventoryMovement.create = async (documents) => {
    if (failMovement) throw new Error('movement insert failed');
    state.movements.push(...documents);
    return documents;
  };
  Sale.create = async (documents) => {
    const created = documents.map((document) => {
      state.serial += 1;
      return {
        ...document,
        _id: (BigInt(`0x${saleId}`) + BigInt(state.serial))
          .toString(16)
          .padStart(24, '0'),
      };
    });
    state.sales.push(...created);
    return created;
  };
  Sale.findOne = (filter) => ({
    session: async () =>
      draft &&
      filter._id === saleId &&
      filter.companyId === draftCompany
        ? draft
        : null,
  });
  mongoose.startSession = async () => ({
    withTransaction: (callback) => {
      const transaction = transactionQueue.then(async () => {
        const stockSnapshot = { ...state.stocks };
        const movementCount = state.movements.length;
        const saleCount = state.sales.length;
        try {
          await callback();
        } catch (error) {
          if (rollback) {
            state.stocks = stockSnapshot;
            state.movements.length = movementCount;
            state.sales.length = saleCount;
          } else {
            const attemptedSaleIds = new Set(
              state.sales.slice(saleCount).map((sale) => String(sale._id))
            );
            state.sales = state.sales.filter(
              (sale) => !attemptedSaleIds.has(String(sale._id))
            );
            state.movements = state.movements.filter(
              (movement) =>
                !attemptedSaleIds.has(String(movement.referenceId))
            );
          }
          throw error;
        }
      });
      transactionQueue = transaction.catch(() => {});
      return transaction;
    },
    endSession: async () => {},
  });

  try {
    await run({
      state,
      user: {
        sub: userId,
        role,
        companyId: userCompany,
        branchId: userBranch,
      },
      draft,
      payload: {
        companyId: companyA,
        customerId: customerA,
        warehouseId: warehouseA,
        paymentMethod: 'CASH',
        items: [
          { productId: productA, quantity: 2, price: 1 },
          { productId: productB, quantity: 1, price: 1 },
        ],
      },
      companyA,
      companyB,
      customerA,
      productA,
      productB,
      warehouseA,
    });
  } finally {
    for (const [Model, method, original] of originals) Model[method] = original;
    mongoose.startSession = originalStartSession;
    if (originalDatabaseState === 0) mongoose.connection.emit('disconnected');
  }
}

test('Una venta confirmada calcula precios del catálogo y procesa varios productos', async () => {
  await withSalesMocks({
    run: async ({ payload, user, state, productA, productB }) => {
      const sale = await createSale(
        { ...payload, tax: 5000, discount: 40, total: 1 },
        user
      );
      assert.equal(sale.status, 'CONFIRMED');
      assert.equal(sale.subtotal, 45);
      assert.equal(sale.total, 45);
      assert.deepEqual(
        sale.items.map((item) => [String(item.productId), item.price, item.subtotal]),
        [
          [productA, 10, 20],
          [productB, 25, 25],
        ]
      );
      assert.equal(state.stocks[productA], 8);
      assert.equal(state.stocks[productB], 9);
      assert.equal(state.movements.length, 2);
      assert.ok(state.movements.every((movement) => movement.type === 'SALE'));
      assert.ok(
        state.movements.every(
          (movement) => String(movement.referenceId) === String(sale._id)
        )
      );
      assert.deepEqual(
        state.inventoryConditions.map((condition) => condition.quantity.$gte),
        [2, 1]
      );
    },
  });
});

test('No permite vender un cliente de otra empresa', async () => {
  await withSalesMocks({
    customerCompany: companyB,
    run: async ({ payload, user, state }) => {
      await assert.rejects(
        createSale(payload, user),
        (error) => error.statusCode === 404
      );
      assert.equal(state.sales.length, 0);
      assert.equal(state.movements.length, 0);
    },
  });
});

test('No permite vender un producto de otra empresa', async () => {
  await withSalesMocks({
    productCompanies: { [productA]: companyB },
    run: async ({ payload, user, state }) => {
      await assert.rejects(
        createSale(payload, user),
        (error) => error.statusCode === 404
      );
      assert.equal(state.sales.length, 0);
    },
  });
});

test('No permite utilizar almacén de otra empresa', async () => {
  await withSalesMocks({
    warehouseCompany: companyB,
    run: async ({ payload, user, state }) => {
      await assert.rejects(
        createSale(payload, user),
        (error) => error.statusCode === 404
      );
      assert.equal(state.sales.length, 0);
    },
  });
});

test('Usuario de ventas no puede usar un almacén de otra sucursal', async () => {
  await withSalesMocks({
    role: 'VENTAS',
    userBranch: branchA,
    selectedWarehouseBranch: '507f1f77bcf86cd799439021',
    run: async ({ payload, user, state }) => {
      await assert.rejects(
        createSale(payload, user),
        (error) => error.statusCode === 403
      );
      assert.equal(state.sales.length, 0);
      assert.equal(state.movements.length, 0);
    },
  });
});

test('Rechaza cantidades inválidas y existencia insuficiente', async () => {
  await withSalesMocks({
    run: async ({ payload, user, state }) => {
      await assert.rejects(
        createSale({ ...payload, items: [{ productId: productA, quantity: 0 }] }, user),
        (error) => error.statusCode === 400
      );
      await assert.rejects(
        createSale(
          { ...payload, items: [{ productId: productA, quantity: 11 }] },
          user
        ),
        (error) => error.statusCode === 409
      );
      assert.equal(state.sales.length, 0);
      assert.equal(state.movements.length, 0);
      assert.equal(state.stocks[productA], 10);
    },
  });
});

test('Rollback transaccional revierte venta y stock si falla el ledger', async () => {
  await withSalesMocks({
    failMovement: true,
    run: async ({ payload, user, state }) => {
      await assert.rejects(createSale(payload, user), /movement insert failed/);
      assert.equal(state.sales.length, 0);
      assert.equal(state.movements.length, 0);
      assert.equal(state.stocks[productA], 10);
      assert.equal(state.stocks[productB], 10);
    },
  });
});

test('Ventas simultáneas no pueden consumir el mismo stock restante', async () => {
  await withSalesMocks({
    stocks: { [productA]: 5 },
    rollback: false,
    run: async ({ payload, user, state, productA }) => {
      const salePayload = {
        ...payload,
        items: [{ productId: productA, quantity: 4 }],
      };
      const results = await Promise.allSettled([
        createSale(salePayload, user),
        createSale(salePayload, user),
      ]);
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
      assert.equal(state.stocks[productA], 1);
      assert.equal(state.sales.length, 1);
      assert.equal(state.movements.length, 1);
    },
  });
});

test('Confirma borradores con precios confiables y limita el acceso por empresa', async () => {
  await withSalesMocks({
    includeDraft: true,
    run: async ({ user, state, companyA, warehouseA, draft }) => {
      const sale = await confirmSale(saleId, warehouseA, companyA, user);
      assert.equal(sale.status, 'CONFIRMED');
      assert.equal(sale.items[0].price, 10);
      assert.equal(sale.total, 20);
      assert.equal(state.stocks[productA], 8);
      assert.equal(state.movements.length, 1);
      assert.equal(draft.status, 'CONFIRMED');
    },
  });

  await withSalesMocks({
    includeDraft: true,
    warehouseCompany: companyB,
    selectedWarehouse: warehouseB,
    selectedWarehouseBranch: '507f1f77bcf86cd799439021',
    run: async ({ user, state, companyB }) => {
      await assert.rejects(
        confirmSale(saleId, warehouseB, companyB, user),
        (error) => error.statusCode === 404
      );
      assert.equal(state.sales[0].status, 'DRAFT');
      assert.equal(state.stocks[productA], 10);
      assert.equal(state.movements.length, 0);
    },
  });
});
