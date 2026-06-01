import { z } from 'zod';

const emailConfig = z.object({
  to: z.array(z.string().email()).min(1),
  fromName: z.string().optional(),
});

const slackConfig = z.object({
  webhookUrl: z.string().url(),
});

const webhookConfig = z.object({
  url: z.string().url(),
  method: z.enum(['POST', 'PUT']).default('POST'),
  headers: z.record(z.string()).optional(),
});

export const createChannelSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('EMAIL'),   name: z.string().min(1).max(100), minSeverity: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('LOW'), config: emailConfig }),
  z.object({ type: z.literal('SLACK'),   name: z.string().min(1).max(100), minSeverity: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('LOW'), config: slackConfig }),
  z.object({ type: z.literal('WEBHOOK'), name: z.string().min(1).max(100), minSeverity: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('LOW'), config: webhookConfig }),
]);

export const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  minSeverity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  isActive: z.boolean().optional(),
});
