import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyRole, ROLES } from '../../middleware/authorization.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  create,
  list,
  get,
  update,
  acknowledge,
  assign,
  resolve,
  close,
  addComment,
  getTimeline,
} from './incidents.controller.js';

const router = Router();
router.use(authenticate);

// Read — VIEWER+
router.get('/',              asyncHandler(list));
router.get('/:id',           asyncHandler(get));
router.get('/:id/timeline',  asyncHandler(getTimeline));

// Mutate — DEVELOPER+
router.post('/',
  requireAnyRole(ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER),
  asyncHandler(create),
);
router.patch('/:id',
  requireAnyRole(ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER),
  asyncHandler(update),
);
router.post('/:id/acknowledge',
  requireAnyRole(ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER),
  asyncHandler(acknowledge),
);
router.post('/:id/assign',
  requireAnyRole(ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER),
  asyncHandler(assign),
);
router.post('/:id/resolve',
  requireAnyRole(ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER),
  asyncHandler(resolve),
);
router.post('/:id/comments',
  requireAnyRole(ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER),
  asyncHandler(addComment),
);

// Close — ADMIN/OWNER only
router.post('/:id/close',
  requireAnyRole(ROLES.OWNER, ROLES.ADMIN),
  asyncHandler(close),
);

export default router;
