import { z } from 'zod';
import { BUCKET_SECONDS, RANGE_SECONDS } from '../../utils/timeWindow.js';

export const serviceSummaryQuerySchema = z.object({
  range: z.enum(Object.keys(RANGE_SECONDS)).default('24h'),
  bucket: z.enum(['auto', ...Object.keys(BUCKET_SECONDS)]).default('auto'),
});
