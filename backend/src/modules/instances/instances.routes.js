import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getInstances, createInstance, updateInstanceStatus, deleteInstance } from './instances.controller.js';
import { getSdTargets } from './instances.sd.js';

const router = Router();

// sd-targets is public so vmagent can scrape without auth
router.get('/sd-targets', asyncHandler(getSdTargets));

router.get('/',       authenticate, asyncHandler(getInstances));
router.post('/',      authenticate, asyncHandler(createInstance));
router.patch('/:id',  authenticate, asyncHandler(updateInstanceStatus));
router.delete('/:id', authenticate, asyncHandler(deleteInstance));

export default router;
