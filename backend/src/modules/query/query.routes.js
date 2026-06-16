import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole, ROLES } from '../../middleware/authorization.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { instant, range, labels } from './query.controller.js';

const router = Router();
router.use(authenticate);
router.use(requireRole(ROLES.VIEWER));

// Instant query:  GET  /api/query/instant?query=<promql>&time=<ts>
//                 POST /api/query/instant  { query, time? }
router.get('/instant', asyncHandler(instant));
router.post('/instant', asyncHandler(instant));

// Range query:    GET  /api/query/range?query=<promql>&start=&end=&step=
//                 POST /api/query/range   { query, start, end, step? }
router.get('/range', asyncHandler(range));
router.post('/range', asyncHandler(range));

// Label values:   GET  /api/query/labels?label=node&match=node_cpu_seconds_total
router.get('/labels', asyncHandler(labels));

export default router;
