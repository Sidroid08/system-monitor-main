import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().nullable(),
});
