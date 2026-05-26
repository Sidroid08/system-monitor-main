import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getAlerts, postAlert, patchAlert, deleteAlert, getStats } from './alerts.controller.js';

const router = Router();

router.get('/stats',  authenticate, asyncHandler(getStats));
router.get('/',       authenticate, asyncHandler(getAlerts));
router.post('/',      authenticate, asyncHandler(postAlert));
router.patch('/:id',  authenticate, asyncHandler(patchAlert));
router.delete('/:id', authenticate, asyncHandler(deleteAlert));

export default router;
