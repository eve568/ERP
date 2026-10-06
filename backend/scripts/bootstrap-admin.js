import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Company } from '../src/models/company.model.js';
import { User } from '../src/models/user.model.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const { env } = await import('../src/config/env.js');
const bootstrapLockId = 'initial-company-admin';

class BootstrapError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BootstrapError';
  }
}

function requiredValue(name, maxLength) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new BootstrapError(`Falta la variable requerida ${name}.`);
  }
  if (value.length > maxLength) {
    throw new BootstrapError(`La variable ${name} excede el máximo permitido.`);
  }
  return value;
}

function collectInput() {
  const input = {
    company: {
      name: requiredValue('BOOTSTRAP_COMPANY_NAME', 160),
      legalName: requiredValue('BOOTSTRAP_COMPANY_LEGAL_NAME', 200),
      taxId: requiredValue('BOOTSTRAP_COMPANY_TAX_ID', 30).toUpperCase(),
    },
    admin: {
      firstName: requiredValue('BOOTSTRAP_ADMIN_FIRST_NAME', 80),
      lastName: requiredValue('BOOTSTRAP_ADMIN_LAST_NAME', 120),
      email: requiredValue('BOOTSTRAP_ADMIN_EMAIL', 160).toLowerCase(),
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '',
    },
  };

  if (!input.admin.password || input.admin.password.length < 8) {
    throw new BootstrapError(
      'BOOTSTRAP_ADMIN_PASSWORD debe tener al menos 8 caracteres.',
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.admin.email)) {
    throw new BootstrapError('BOOTSTRAP_ADMIN_EMAIL no tiene un formato válido.');
  }

  return input;
}

async function ensureBootstrapIsAvailable() {
  const lockCollection = mongoose.connection.collection('erp_bootstrap_control');
  const lock = await lockCollection.findOne({ _id: bootstrapLockId });
  const companyExists = await Company.exists({});
  const adminExists = await User.exists({ role: 'ADMIN' });

  if (lock || companyExists || adminExists) {
    throw new BootstrapError(
      'El bootstrap inicial ya no está disponible: existe una empresa, un administrador o una marca de bootstrap.',
    );
  }
}

function isTransactionUnsupported(error) {
  return (
    error?.codeName === 'IllegalOperation' ||
    /transaction numbers are only allowed|does not support transactions|replica set/i.test(
      error?.message ?? '',
    )
  );
}

async function provision(input) {
  const passwordHash = await bcrypt.hash(input.admin.password, 12);
  const companyId = new mongoose.Types.ObjectId();
  const companyData = {
    _id: companyId,
    ...input.company,
  };
  const adminData = {
    firstName: input.admin.firstName,
    lastName: input.admin.lastName,
    email: input.admin.email,
    passwordHash,
    role: 'ADMIN',
    status: 'ACTIVE',
    companyId,
  };

  await new Company(companyData).validate();
  await new User(adminData).validate();
  await ensureBootstrapIsAvailable();

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const lockCollection = mongoose.connection.collection(
        'erp_bootstrap_control',
      );
      const lock = await lockCollection.findOne(
        { _id: bootstrapLockId },
        { session },
      );
      const companyExists = await Company.exists({}).session(session);
      const adminExists = await User.exists({ role: 'ADMIN' }).session(session);
      const emailExists = await User.exists({ email: input.admin.email }).session(
        session,
      );

      if (lock || companyExists || adminExists) {
        throw new BootstrapError(
          'El bootstrap inicial ya no está disponible: existe una empresa, un administrador o una marca de bootstrap.',
        );
      }
      if (emailExists) {
        throw new BootstrapError(
          'El correo de administrador ya está registrado.',
        );
      }

      await lockCollection.insertOne(
        { _id: bootstrapLockId, createdAt: new Date() },
        { session },
      );
      await new Company(companyData).save({ session });
      await new User(adminData).save({ session });
    });
  } catch (error) {
    if (error instanceof BootstrapError) throw error;
    if (isTransactionUnsupported(error)) {
      throw new BootstrapError(
        'MongoDB no admite transacciones en esta configuración. Se abortó el bootstrap sin usar escrituras no transaccionales.',
      );
    }
    throw new BootstrapError(
      'No se pudo completar el bootstrap. La transacción fue abortada; revisa la configuración y los datos sin compartir secretos.',
    );
  } finally {
    await session.endSession();
  }

  return companyId.toString();
}

async function main() {
  let connected = false;
  try {
    const input = collectInput();
    if (!env.mongodbUri || env.mongodbUri.includes('<usuario>') || env.mongodbUri.includes('<password>')) {
      throw new BootstrapError(
        'MONGODB_URI no está configurada con una conexión utilizable.',
      );
    }

    await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 5000 });
    connected = true;
    const companyId = await provision(input);
    console.log(
      `Bootstrap completado. Empresa y usuario ADMIN creados. companyId=${companyId}`,
    );
  } catch (error) {
    console.error(
      error instanceof BootstrapError
        ? error.message
        : 'El bootstrap no se completó. No se imprimen detalles potencialmente sensibles.',
    );
    process.exitCode = 1;
  } finally {
    if (connected) {
      await mongoose.disconnect();
    }
  }
}

const invokedDirectly =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  await main();
}
