import { z } from 'zod';

export const createAlertRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  promql: z.string().min(1),
  condition: z.enum(['GT', 'GTE', 'LT', 'LTE', 'EQ']),
  threshold: z.number(),
  forCycles: z.number().int().min(1).max(100).default(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  isActive: z.boolean().default(true),
});

export const updateAlertRuleSchema = createAlertRuleSchema.partial();
