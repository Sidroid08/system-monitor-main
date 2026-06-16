import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyRole, ROLES } from '../../middleware/authorization.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { create, list, revoke } from './apiKeys.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', requireAnyRole(ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER), asyncHandler(list));
router.post('/', requireAnyRole(ROLES.OWNER, ROLES.ADMIN), asyncHandler(create));
router.post('/:id/revoke', requireAnyRole(ROLES.OWNER, ROLES.ADMIN), asyncHandler(revoke));
router.delete('/:id', requireAnyRole(ROLES.OWNER, ROLES.ADMIN), asyncHandler(revoke));

export default router;
