import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorization.js';
import { queryRateLimiter } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getLogStats, listLogs, getLog } from './logs.controller.js';

const router = Router();

router.use(authenticate);

router.get('/',      requireRole('VIEWER'), queryRateLimiter, asyncHandler(listLogs));
router.get('/stats', requireRole('VIEWER'), queryRateLimiter, asyncHandler(getLogStats));
router.get('/:id',   requireRole('VIEWER'), asyncHandler(getLog));

export default router;
