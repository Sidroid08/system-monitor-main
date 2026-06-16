import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorization.js';
import { queryRateLimiter } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { aggregateMetrics, listMetrics, listMetricNames } from './metrics.controller.js';

const router = Router();

router.use(authenticate);

router.get('/',      requireRole('VIEWER'), queryRateLimiter, asyncHandler(listMetrics));
router.get('/names', requireRole('VIEWER'), asyncHandler(listMetricNames));
router.get('/aggregate', requireRole('VIEWER'), queryRateLimiter, asyncHandler(aggregateMetrics));

export default router;
