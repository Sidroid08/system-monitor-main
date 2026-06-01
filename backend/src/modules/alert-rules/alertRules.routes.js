import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { create, list, get, update, remove } from './alertRules.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(list));
router.post('/', asyncHandler(create));
router.get('/:id', asyncHandler(get));
router.patch('/:id', asyncHandler(update));
router.delete('/:id', asyncHandler(remove));

export default router;
