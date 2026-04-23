import { z } from 'zod';

export const createAwsAccountSchema = z.object({
  organizationId: z.string().uuid(),
  accountName: z.string().min(1),
  accountId: z.string().optional(),
  region: z.string().min(1),

  // auth fields
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),

  roleArn: z.string().optional(),
  externalId: z.string().optional(),

  authMode: z.enum(['STATIC_KEYS', 'ASSUME_ROLE']).default('STATIC_KEYS'),
});