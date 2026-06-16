import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole, ROLES } from '../../middleware/authorization.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  overview,
  serviceSummary,
  retentionStatus,
  victoriaMetricsHealth,
} from './observability.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireRole(ROLES.VIEWER));

router.get('/overview', asyncHandler(overview));
router.get('/services/:serviceId/summary', asyncHandler(serviceSummary));
router.get('/retention/status', asyncHandler(retentionStatus));
router.get('/victoriametrics/health', asyncHandler(victoriaMetricsHealth));

export default router;
