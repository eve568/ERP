import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { getDatabaseState } from '../../config/database.js';
import { User } from '../../models/user.model.js';
import { Company } from '../../models/company.model.js';
import { Branch } from '../../models/branch.model.js';
import { Category } from '../../models/category.model.js';
import { Warehouse } from '../../models/warehouse.model.js';
import { AppError } from '../../utils/errors.js';

function ensureAuthConfiguration() {
  if (getDatabaseState() !== 'connected') {
    throw new AppError('El servicio de autenticación no está disponible', 503);
  }
  if (!env.jwtSecret) {
    throw new AppError('El servicio de autenticación no está configurado', 503);
  }
}

async function resolveAutomaticCompanyId() {
  const companies = await Company.find({ status: 'ACTIVE' })
    .sort({ createdAt: 1, _id: 1 })
    .select('_id')
    .limit(2)
    .lean();

  if (companies.length === 0) {
    throw new AppError('No hay una empresa activa disponible para asignar al usuario', 409);
  }

  if (companies.length > 1) {
    throw new AppError('Hay varias empresas activas; un administrador debe asignar la empresa del usuario', 409);
  }

  return companies[0]._id;
}

function publicUser(user) {
  return {
    id: user.id ?? user._id?.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    companyId: user.companyId ?? null,
    branchId: user.branchId ?? null
  };
}

export async function registerUser({ firstName, lastName, email, phone, password }) {
  ensureAuthConfiguration();
  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail }).lean();
  if (existingUser) throw new AppError('El correo ya está registrado', 409);

  const companyId = await resolveAutomaticCompanyId();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    firstName,
    lastName,
    email: normalizedEmail,
    phone,
    passwordHash,
    role: 'EMPLEADO',
    companyId
  });
  return publicUser(user);
}

export async function loginUser({ email, password }) {
  ensureAuthConfiguration();
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
  if (!user || user.status !== 'ACTIVE' || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError('Credenciales inválidas', 401);
  }

  // Modo de pruebas: todo usuario sin empresa recibe automáticamente un
  // contexto válido. Si no existe ninguna empresa activa, se crea una empresa
  // técnica de pruebas para evitar bloqueos repetidos por companyId.
  if (!user.companyId) {
    let company = await Company.findOne({ status: 'ACTIVE' })
      .sort({ createdAt: 1, _id: 1 })
      .select('_id')
      .lean();

    if (!company) {
      company = await Company.findOneAndUpdate(
        { taxId: 'ERP-TEST' },
        {
          $setOnInsert: {
            name: 'Empresa de Pruebas',
            legalName: 'Empresa de Pruebas ERP',
            taxId: 'ERP-TEST'
          },
          $set: { status: 'ACTIVE' }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).lean();
    }

    user.companyId = company._id;
    await user.save();
  }

  // Bootstrap idempotente para pruebas: deja listo el contexto mínimo que
  // necesitan catálogo, inventario y ventas.
  const companyId = user.companyId;
  let branch = await Branch.findOne({ companyId, status: 'ACTIVE' })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (!branch) {
    branch = await Branch.findOneAndUpdate(
      { companyId, name: 'Principal' },
      {
        $setOnInsert: {
          companyId,
          name: 'Principal',
          address: 'Sucursal de pruebas'
        },
        $set: { status: 'ACTIVE' }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
  }

  await Category.findOneAndUpdate(
    { companyId, name: 'General' },
    {
      $setOnInsert: {
        companyId,
        name: 'General',
        description: 'Categoría automática para pruebas'
      },
      $set: { status: 'ACTIVE' }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await Warehouse.findOneAndUpdate(
    { companyId, name: 'Pruebas' },
    {
      $setOnInsert: {
        companyId,
        name: 'Pruebas',
        branchId: branch._id,
        address: 'Almacén automático para pruebas'
      },
      $set: {
        branchId: branch._id,
        status: 'ACTIVE'
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  if (!user.branchId || String(user.branchId) !== String(branch._id)) {
    user.branchId = branch._id;
    await user.save();
  }

  const token = jwt.sign({
    sub: user.id,
    role: user.role,
    email: user.email,
    companyId: user.companyId?.toString(),
    branchId: user.branchId?.toString()
  }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  return { token, user: publicUser(user) };
}

export async function getCurrentUser(userId) {
  ensureAuthConfiguration();
  const user = await User.findById(userId);
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError('Usuario no encontrado o inactivo', 401);
  }
  return publicUser(user);
}

export async function changePassword(userId, currentPassword, newPassword) {
  ensureAuthConfiguration();
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError('La contraseña actual no es válida', 401);
  }
  if (newPassword.length < 8) throw new AppError('La nueva contraseña debe tener al menos 8 caracteres', 400);
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
}