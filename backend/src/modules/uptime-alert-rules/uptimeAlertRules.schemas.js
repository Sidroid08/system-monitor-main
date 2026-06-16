import { z } from 'zod';

export const UPTIME_RULE_TYPES = ['SERVICE_DOWN', 'SERVICE_DEGRADED', 'RESPONSE_TIME_ABOVE', 'CONSECUTIVE_FAILURES'];

// Rules that require a numeric threshold.
const THRESHOLD_REQUIRED_TYPES = new Set(['RESPONSE_TIME_ABOVE', 'CONSECUTIVE_FAILURES']);

const baseRuleSchema = z.object({
  name:                  z.string().min(1).max(200),
  type:                  z.enum(UPTIME_RULE_TYPES),
  severity:              z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  isActive:              z.boolean().default(true),
  // Positive integer; meaning is type-dependent (ms or failure count).
  threshold:             z.number().int().positive().optional(),
  cooldownSeconds:       z.number().int().min(0).max(86400).default(300),
  // Optional FK — validated against org at create time.
  serviceId:             z.string().uuid().optional(),
  notificationChannelId: z.string().uuid().optional(),
});

export const createUptimeAlertRuleSchema = baseRuleSchema.superRefine((value, ctx) => {
  if (THRESHOLD_REQUIRED_TYPES.has(value.type) && value.threshold == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['threshold'],
      message: `threshold is required for rule type ${value.type}`,
    });
  }
});

export const updateUptimeAlertRuleSchema = baseRuleSchema.partial().superRefine((value, ctx) => {
  // If type is being changed to a threshold-requiring type, threshold must also be supplied.
  if (value.type && THRESHOLD_REQUIRED_TYPES.has(value.type) && value.threshold == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['threshold'],
      message: `threshold is required when setting type to ${value.type}`,
    });
  }
});

export const listUptimeAlertRulesSchema = z.object({
  serviceId: z.string().uuid().optional(),
  isActive:  z.enum(['true', 'false']).optional().transform((v) => v === 'true' ? true : v === 'false' ? false : undefined),
  limit:     z.coerce.number().int().min(1).max(200).default(50),
  offset:    z.coerce.number().int().min(0).default(0),
});
