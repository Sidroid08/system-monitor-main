import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyRole, ROLES } from '../../middleware/authorization.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { create, list, get, update, remove, test } from './notifications.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(list));
router.post('/', requireAnyRole(ROLES.OWNER, ROLES.ADMIN), asyncHandler(create));
router.get('/:id', asyncHandler(get));
router.patch('/:id', requireAnyRole(ROLES.OWNER, ROLES.ADMIN), asyncHandler(update));
router.delete('/:id', requireAnyRole(ROLES.OWNER, ROLES.ADMIN), asyncHandler(remove));
router.post('/:id/test', requireAnyRole(ROLES.OWNER, ROLES.ADMIN), asyncHandler(test));

export default router;
