import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { login, me, register } from './auth.controller.js';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.get('/me', authenticate, asyncHandler(me));

export default router;
