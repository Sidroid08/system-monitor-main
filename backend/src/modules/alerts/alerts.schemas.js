import { z } from 'zod';

export const listAlertsSchema = z.object({
  status:   z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  ruleId:   z.string().uuid().optional(),
  source:   z.string().max(50).optional(),
  limit:    z.coerce.number().int().min(1).max(200).default(50),
  offset:   z.coerce.number().int().min(0).default(0),
});

// Alerts are system-generated; only status transitions are exposed via the API.
// OPEN is excluded — callers cannot re-open a resolved alert.
export const updateAlertSchema = z.object({
  status: z.enum(['ACKNOWLEDGED', 'RESOLVED']),
});
