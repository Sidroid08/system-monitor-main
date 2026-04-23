import { Router } from 'express';
import { createAws, listAws, syncAws } from './aws.controller.js';

const router = Router();

router.post('/', createAws);
router.get('/', listAws);
router.post('/:id/sync', syncAws);

export default router;