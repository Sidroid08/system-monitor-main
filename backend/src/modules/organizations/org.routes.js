import { Router } from 'express';
import { createOrg, listOrgs, getOrgById } from './org.controller.js';

const router = Router();

router.post('/', createOrg);
router.get('/', listOrgs);
router.get('/:id', getOrgById);

export default router;