import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyRole, ROLES } from '../../middleware/authorization.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createAws, listAws, syncAws } from './aws.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listAws));
router.post('/', requireAnyRole(ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER), asyncHandler(createAws));
router.post('/:id/sync', requireAnyRole(ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER), asyncHandler(syncAws));

export default router;
