import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing bearer token' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, env.jwtSecret);

    if (!payload.sub || !payload.organizationId || !payload.role) {
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      organizationId: payload.organizationId,
      role: payload.role,
    };

    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}
