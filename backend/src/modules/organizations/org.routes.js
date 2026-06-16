import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyRole, ROLES } from '../../middleware/authorization.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createOrg, listOrgs, getOrgById } from './org.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', requireAnyRole(ROLES.OWNER, ROLES.ADMIN), asyncHandler(createOrg));
router.get('/', asyncHandler(listOrgs));
router.get('/:id', asyncHandler(getOrgById));

export default router;
