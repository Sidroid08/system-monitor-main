import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createAws, listAws, syncAws } from './aws.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', asyncHandler(createAws));
router.get('/', asyncHandler(listAws));
router.post('/:id/sync', asyncHandler(syncAws));

export default router;