import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyRole, ROLES } from '../../middleware/authorization.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { create, list, get, update, remove } from './alertRules.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(list));
router.post('/', requireAnyRole(ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER), asyncHandler(create));
router.get('/:id', asyncHandler(get));
router.patch('/:id', requireAnyRole(ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER), asyncHandler(update));
router.delete('/:id', requireAnyRole(ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER), asyncHandler(remove));

export default router;
