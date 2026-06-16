import { badRequest } from './errors.js';

export function encodeTelemetryCursor(row) {
  if (!row?.id || !row?.timestamp) return null;
  const timestamp = row.timestamp instanceof Date
    ? row.timestamp.toISOString()
    : new Date(row.timestamp).toISOString();

  return Buffer
    .from(JSON.stringify({ timestamp, id: row.id }), 'utf8')
    .toString('base64url');
}

export function decodeTelemetryCursor(cursor) {
  if (!cursor) return null;

  try {
    const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const timestamp = new Date(payload.timestamp);
    if (!payload.id || Number.isNaN(timestamp.getTime())) {
      throw new Error('Invalid cursor payload');
    }
    return { timestamp, id: payload.id };
  } catch {
    throw badRequest('Invalid pagination cursor');
  }
}

export function buildTimestampCursorWhere(cursor) {
  const decoded = decodeTelemetryCursor(cursor);
  if (!decoded) return null;

  return {
    OR: [
      { timestamp: { lt: decoded.timestamp } },
      { timestamp: decoded.timestamp, id: { lt: decoded.id } },
    ],
  };
}
