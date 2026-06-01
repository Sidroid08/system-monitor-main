import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ok } from '../../utils/apiResponse.js';
import { findUserByEmail, createOrgAndAdmin } from './auth.repository.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    organization: user.organization
      ? { id: user.organization.id, name: user.organization.name, slug: user.organization.slug }
      : undefined,
    createdAt: user.createdAt,
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export async function register(req, res) {
  const payload = registerSchema.parse(req.body);

  const existing = await findUserByEmail(payload.email.toLowerCase());
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(payload.password, 10);
  const user = await createOrgAndAdmin({
    orgName: payload.organizationName,
    name: payload.name,
    email: payload.email.toLowerCase(),
    passwordHash,
  });

  const safe = safeUser(user);
  return ok(res, { user: safe, token: signToken(safe) }, 'User registered', 201);
}

export async function login(req, res) {
  const payload = loginSchema.parse(req.body);

  const user = await findUserByEmail(payload.email.toLowerCase());
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account is inactive' });
  }

  const matches = await bcrypt.compare(payload.password, user.passwordHash);
  if (!matches) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const safe = safeUser(user);
  return ok(res, { user: safe, token: signToken(safe) }, 'Login successful');
}

export async function me(req, res) {
  return ok(res, { user: req.user }, 'Current user');
}
