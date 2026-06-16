import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { resolveAuthContext } from '../lib/authContext.js';

let authContextResolver = resolveAuthContext;

export function setAuthContextResolverForTests(resolver) {
  if (env.nodeEnv !== 'test') return;
  authContextResolver = resolver ?? resolveAuthContext;
}

export function resetAuthContextResolverForTests() {
  if (env.nodeEnv !== 'test') return;
  authContextResolver = resolveAuthContext;
}

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing bearer token' });
  }

  const token = header.slice(7);
  let payload;

  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (error) {
    if (error?.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  if (!payload.sub || !payload.organizationId) {
    return res.status(401).json({ success: false, message: 'Invalid token payload' });
  }

  try {
    const userContext = await authContextResolver(payload);
    if (!userContext) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive session' });
    }

    req.user = userContext;
    return next();
  } catch (error) {
    return next(error);
  }
}
