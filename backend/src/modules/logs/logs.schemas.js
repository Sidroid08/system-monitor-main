import { z } from 'zod';

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

export const listLogsQuerySchema = z.object({
  serviceId:   z.string().uuid().optional(),
  level:       z.enum(LOG_LEVELS).optional(),
  environment: z.string().max(50).optional(),
  traceId:     z.string().max(128).optional(),
  from:        z.coerce.date().optional(),
  to:          z.coerce.date().optional(),
  search:      z.string().max(200).optional(),
  cursor:      z.string().optional(),
  limit:       z.coerce.number().int().min(1).max(500).default(50),
});
