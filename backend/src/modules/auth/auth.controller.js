import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ok } from '../../utils/apiResponse.js';
import { createUser, findUserByEmail } from './auth.repository.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

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

  const existing = await findUserByEmail(payload.email);
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(payload.password, 10);
  const user = await createUser({
    name: payload.name,
    email: payload.email,
    passwordHash,
  });

  const token = signToken(user);
  return ok(res, { user, token }, 'User registered', 201);
}

export async function login(req, res) {
  const payload = loginSchema.parse(req.body);

  const user = await findUserByEmail(payload.email);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const matches = await bcrypt.compare(payload.password, user.passwordHash);
  if (!matches) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = signToken(user);
  return ok(
    res,
    {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    },
    'Login successful',
  );
}

export async function me(req, res) {
  return ok(
    res,
    {
      id: req.user.sub,
      name: req.user.name,
      email: req.user.email,
      organizationId: req.user.organizationId,
      role: req.user.role,
    },
    'Current user',
  );
}
