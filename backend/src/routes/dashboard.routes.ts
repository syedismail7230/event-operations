import { Router } from 'express';
import { getRootMetrics, getPendingUsers, approveUser, getAllUsers, suspendOrganization, modifyUserIAM, getAuditLogs, getFeatureToggles, toggleFeature, getSubscriptions, emergencyHaltEvent, getSupportTickets, getSystemNotifications, broadcastNotification, getSecurityEvents, getPlatformSettings, getSystemHealthLayer, getOrganizationDetails, getPublicEvents } from '../controllers/dashboard.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Root Admin routes
router.get('/root/metrics', authenticateJWT, requireRole(['ROOT_ADMIN']), getRootMetrics);
router.get('/root/pending-users', authenticateJWT, requireRole(['ROOT_ADMIN']), getPendingUsers);
router.get('/root/all-users', authenticateJWT, requireRole(['ROOT_ADMIN']), getAllUsers);
router.post('/root/approve-user', authenticateJWT, requireRole(['ROOT_ADMIN']), approveUser);
router.post('/root/organization/suspend', authenticateJWT, requireRole(['ROOT_ADMIN']), suspendOrganization);
router.get('/root/organization/:id', authenticateJWT, requireRole(['ROOT_ADMIN']), getOrganizationDetails);
router.post('/root/users/iam', authenticateJWT, requireRole(['ROOT_ADMIN']), modifyUserIAM);

// Real-Time Subsystems
router.get('/root/audit', authenticateJWT, requireRole(['ROOT_ADMIN']), getAuditLogs);
router.get('/root/features', authenticateJWT, requireRole(['ROOT_ADMIN']), getFeatureToggles);
router.post('/root/features/toggle', authenticateJWT, requireRole(['ROOT_ADMIN']), toggleFeature);
router.get('/root/billing', authenticateJWT, requireRole(['ROOT_ADMIN']), getSubscriptions);
router.post('/root/events/halt', authenticateJWT, requireRole(['ROOT_ADMIN']), emergencyHaltEvent);

// Public Layer
router.get('/public/events', authenticateJWT, getPublicEvents);

// Phase 4 Extensions
router.get('/root/support', authenticateJWT, requireRole(['ROOT_ADMIN']), getSupportTickets);
router.get('/root/notifications', authenticateJWT, requireRole(['ROOT_ADMIN']), getSystemNotifications);
router.post('/root/notifications/broadcast', authenticateJWT, requireRole(['ROOT_ADMIN']), broadcastNotification);
router.get('/root/security', authenticateJWT, requireRole(['ROOT_ADMIN']), getSecurityEvents);
router.get('/root/settings', authenticateJWT, requireRole(['ROOT_ADMIN']), getPlatformSettings);
router.get('/root/health', authenticateJWT, requireRole(['ROOT_ADMIN']), getSystemHealthLayer);

// Org Admin metrics now served by /dashboard/org/* via org.routes

export default router;
