import prisma from './prisma.js';

function requestMetadata(req) {
  if (!req) return {};
  return {
    ipAddress: req.ip,
    userAgent: req.get?.('user-agent'),
  };
}

export async function writeAuditLog({
  req = null,
  organizationId,
  actorUserId = req?.user?.id ?? null,
  action,
  resourceType,
  resourceId = null,
  metadata = undefined,
}) {
  if (!organizationId || !action || !resourceType) return;

  try {
    await prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId,
        action,
        resourceType,
        resourceId,
        metadata,
        ...requestMetadata(req),
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Audit log write failed', error);
    }
  }
}
