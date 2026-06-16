import { z } from 'zod';

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUSES   = ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED', 'CLOSED'];

export const createIncidentSchema = z.object({
  title:             z.string().min(1).max(255),
  description:       z.string().max(5000).optional(),
  severity:          z.enum(SEVERITIES).default('MEDIUM'),
  serviceId:         z.string().uuid().optional(),
  alertId:           z.string().uuid().optional(),
  alertRuleId:       z.string().uuid().optional(),
  startedAt:         z.string().datetime().optional(),
  impactSummary:     z.string().max(2000).optional(),
  metadata:          z.record(z.unknown()).optional(),
});

export const updateIncidentSchema = z.object({
  title:             z.string().min(1).max(255).optional(),
  description:       z.string().max(5000).optional(),
  severity:          z.enum(SEVERITIES).optional(),
  impactSummary:     z.string().max(2000).optional(),
  rootCause:         z.string().max(2000).optional(),
  preventionNotes:   z.string().max(2000).optional(),
  metadata:          z.record(z.unknown()).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' });

export const acknowledgeSchema = z.object({
  message: z.string().max(500).optional(),
});

export const assignSchema = z.object({
  assignedToUserId: z.string().uuid(),
});

export const resolveSchema = z.object({
  resolutionSummary: z.string().max(2000).optional(),
  rootCause:         z.string().max(2000).optional(),
  message:           z.string().max(500).optional(),
});

export const closeSchema = z.object({
  message: z.string().max(500).optional(),
});

export const commentSchema = z.object({
  message: z.string().min(1).max(1000),
});

export const listQuerySchema = z.object({
  limit:     z.coerce.number().int().min(1).max(200).default(50),
  offset:    z.coerce.number().int().min(0).default(0),
  status:    z.enum(STATUSES).optional(),
  severity:  z.enum(SEVERITIES).optional(),
  serviceId: z.string().uuid().optional(),
});
