import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyRole, ROLES } from '../../middleware/authorization.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { list, get, update } from './alerts.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(list));
router.get('/:id', asyncHandler(get));
router.patch('/:id', requireAnyRole(ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER), asyncHandler(update));

export default router;
