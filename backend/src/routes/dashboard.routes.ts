import { Router } from 'express';
import { getRootMetrics, getOrgMetrics, getPendingUsers, approveUser } from '../controllers/dashboard.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Root Admin routes
router.get('/root/metrics', authenticateJWT, requireRole(['ROOT_ADMIN']), getRootMetrics);
router.get('/root/pending-users', authenticateJWT, requireRole(['ROOT_ADMIN']), getPendingUsers);
router.post('/root/approve-user', authenticateJWT, requireRole(['ROOT_ADMIN']), approveUser);

// Org Admin Only
router.get('/org/metrics', authenticateJWT, requireRole(['ORG_ADMIN']), getOrgMetrics);

export default router;
