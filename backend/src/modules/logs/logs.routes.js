import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorization.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listLogs, getLog } from './logs.controller.js';

const router = Router();

router.use(authenticate);

router.get('/',    requireRole('VIEWER'), asyncHandler(listLogs));
router.get('/:id', requireRole('VIEWER'), asyncHandler(getLog));

export default router;
