import { Router } from 'express';
import { authenticateApiKey, requireApiKeyScope } from '../../middleware/apiKeyAuth.js';
import { ingestionRateLimiter } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ingestLogs, ingestMetrics } from './ingest.controller.js';

const router = Router();

router.post(
  '/logs',
  authenticateApiKey,
  ingestionRateLimiter,
  requireApiKeyScope('logs:write'),
  asyncHandler(ingestLogs),
);

router.post(
  '/metrics',
  authenticateApiKey,
  ingestionRateLimiter,
  requireApiKeyScope('metrics:write'),
  asyncHandler(ingestMetrics),
);

export default router;
