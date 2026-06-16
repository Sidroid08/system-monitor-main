import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorization.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listMetrics, listMetricNames } from './metrics.controller.js';

const router = Router();

router.use(authenticate);

router.get('/',      requireRole('VIEWER'), asyncHandler(listMetrics));
router.get('/names', requireRole('VIEWER'), asyncHandler(listMetricNames));

export default router;
