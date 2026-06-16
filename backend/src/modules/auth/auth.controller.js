import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ok } from '../../utils/apiResponse.js';
import { writeAuditLog } from '../../lib/auditLogger.js';
import { findUserByEmail, createOrgAndAdmin } from './auth.repository.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

function activeMembership(user) {
  return user.memberships?.[0] ?? null;
}

function safeUser(user) {
  const membership = activeMembership(user);
  const organization = membership?.organization ?? user.organization;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: membership?.role ?? user.role,
    legacyRole: user.role,
    organizationId: membership?.organizationId ?? user.organizationId,
    membershipId: membership?.id,
    organization: organization
      ? { id: organization.id, name: organization.name, slug: organization.slug }
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
      membershipId: user.membershipId,
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
  await writeAuditLog({
    req,
    organizationId: safe.organizationId,
    actorUserId: safe.id,
    action: 'organization.created',
    resourceType: 'organization',
    resourceId: safe.organizationId,
    metadata: { source: 'auth.register' },
  });
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

  if (!activeMembership(user)) {
    return res.status(403).json({ success: false, message: 'No active organization membership' });
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
