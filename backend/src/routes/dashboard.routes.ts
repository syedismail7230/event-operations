import { Router } from 'express';
import { getRootMetrics, getOrgMetrics, getPendingUsers, approveUser, getAllUsers, suspendOrganization, modifyUserIAM } from '../controllers/dashboard.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Root Admin routes
router.get('/root/metrics', authenticateJWT, requireRole(['ROOT_ADMIN']), getRootMetrics);
router.get('/root/pending-users', authenticateJWT, requireRole(['ROOT_ADMIN']), getPendingUsers);
router.get('/root/all-users', authenticateJWT, requireRole(['ROOT_ADMIN']), getAllUsers);
router.post('/root/approve-user', authenticateJWT, requireRole(['ROOT_ADMIN']), approveUser);
router.post('/root/organization/suspend', authenticateJWT, requireRole(['ROOT_ADMIN']), suspendOrganization);
router.post('/root/users/iam', authenticateJWT, requireRole(['ROOT_ADMIN']), modifyUserIAM);

// Org Admin Only
router.get('/org/metrics', authenticateJWT, requireRole(['ORG_ADMIN']), getOrgMetrics);

export default router;
