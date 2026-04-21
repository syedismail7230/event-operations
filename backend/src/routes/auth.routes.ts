import { Router } from 'express';
import { syncFirebaseUser, getMe, login, register } from '../controllers/auth.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/sync', syncFirebaseUser);
router.get('/me', authenticateJWT, getMe);

export default router;
