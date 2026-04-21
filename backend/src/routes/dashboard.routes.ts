import { Router } from 'express';
import { getRootMetrics, getOrgMetrics } from '../controllers/dashboard.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Root Admin Only
router.get('/root/metrics', authenticateJWT, requireRole(['ROOT_ADMIN']), getRootMetrics);

// Org Admin Only
router.get('/org/metrics', authenticateJWT, requireRole(['ORG_ADMIN']), getOrgMetrics);

export default router;
