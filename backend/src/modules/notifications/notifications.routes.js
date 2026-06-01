import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { create, list, get, update, remove, test } from './notifications.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(list));
router.post('/', asyncHandler(create));
router.get('/:id', asyncHandler(get));
router.patch('/:id', asyncHandler(update));
router.delete('/:id', asyncHandler(remove));
router.post('/:id/test', asyncHandler(test));

export default router;
