import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyRole, ROLES } from '../../middleware/authorization.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get } from './workerHealth.controller.js';

const router = Router();

router.use(authenticate);
router.get('/', requireAnyRole(ROLES.OWNER, ROLES.ADMIN), asyncHandler(get));

export default router;
