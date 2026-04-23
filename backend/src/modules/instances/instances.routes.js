import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getInstances } from './instances.controller.js';

const router = Router();

router.get('/', authenticate, asyncHandler(getInstances));

export default router;
