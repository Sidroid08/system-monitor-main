import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createAlertRule, getAlertRules, deleteAlertRule, pauseAlertRule, resumeAlertRule } from './alert-rules.controller.js';

const router = Router();

router.get('/', authenticate, asyncHandler(getAlertRules));
router.post('/', authenticate, asyncHandler(createAlertRule));
router.delete('/:id', authenticate, asyncHandler(deleteAlertRule));
router.patch('/:id/pause', authenticate, asyncHandler(pauseAlertRule));
router.patch('/:id/resume', authenticate, asyncHandler(resumeAlertRule));

export default router;
