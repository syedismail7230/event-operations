import { Router } from 'express';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import {
  getOrgMetrics,
  getOrgEvents, createOrgEvent, updateOrgEvent, deleteOrgEvent,
  getOrgUsers, updateUserStatus,
  getOrgCheckIns, createCheckIn, qrScanCheckIn,
  getOrgIncidents, createIncident, updateIncidentStatus,
  getOrgAnalytics,
  getOrgChannels, createOrgChannel, getOrgChannelMembers, addChannelMember, removeChannelMember, deleteOrgChannel,
  getOrgNotifications,
  getOrgAuditLogs,
  getOrgMapData,
  getOrgCommsHistory, broadcastOrgNotification,
  getOrgBilling,
  getOrgSettings, updateOrgSettings,
  getOrgSupportTickets, createOrgSupportTicket,
  getGeoExceptions, grantGeoException, revokeGeoException,
  getAccessCodes, createAccessCode, deleteAccessCode, redeemAccessCode
} from '../controllers/org.controller';

const router = Router();
router.use(authenticateJWT);

// ─── Volunteer-accessible: redeem access code (any authenticated user) ───
router.post('/redeem-code', redeemAccessCode);

// ─── Shared Routes (Accessible by Admin, Manager, Volunteer) ──────────────
const allOrgRoles = ['ORG_ADMIN', 'ROOT_ADMIN', 'MANAGER', 'VOLUNTEER'];
const managerAndAdmin = ['ORG_ADMIN', 'ROOT_ADMIN', 'MANAGER'];
const adminOnly = ['ORG_ADMIN', 'ROOT_ADMIN'];

// Events
router.get('/events', requireRole(allOrgRoles), getOrgEvents);
router.post('/events', requireRole(adminOnly), createOrgEvent);
router.put('/events/:eventId', requireRole(adminOnly), updateOrgEvent);
router.delete('/events/:eventId', requireRole(adminOnly), deleteOrgEvent);

// Check-Ins
router.get('/checkins', requireRole(allOrgRoles), getOrgCheckIns);
router.post('/checkins', requireRole(allOrgRoles), createCheckIn);
router.post('/checkins/qr-scan', requireRole(allOrgRoles), qrScanCheckIn);

// Incidents
router.get('/incidents', requireRole(allOrgRoles), getOrgIncidents);
router.post('/incidents', requireRole(allOrgRoles), createIncident);
router.put('/incidents/:incidentId', requireRole(allOrgRoles), updateIncidentStatus);

// Live Map
router.get('/map', requireRole(allOrgRoles), getOrgMapData);

// PTT Channels
router.get('/channels', requireRole(allOrgRoles), getOrgChannels);
router.post('/channels', requireRole(managerAndAdmin), createOrgChannel);
router.get('/channels/:channelId/members', requireRole(allOrgRoles), getOrgChannelMembers);
router.post('/channels/:channelId/members', requireRole(managerAndAdmin), addChannelMember);
router.delete('/channels/:channelId/members/:userId', requireRole(managerAndAdmin), removeChannelMember);
router.delete('/channels/:channelId', requireRole(managerAndAdmin), deleteOrgChannel);

// Notifications (readable by all roles)
router.get('/notifications', requireRole(allOrgRoles), getOrgNotifications);

// Geo-fence exceptions (accessible to volunteers to grant/revoke)
router.get('/geo-exceptions', requireRole(allOrgRoles), getGeoExceptions);
router.post('/geo-exceptions', requireRole(allOrgRoles), grantGeoException);
router.delete('/geo-exceptions/:eventId/:userId', requireRole(allOrgRoles), revokeGeoException);

// Users (Attendees + Personnel) - Shared so Volunteers can view attendees
router.get('/users', requireRole(allOrgRoles), getOrgUsers);
router.put('/users/:userId', requireRole(managerAndAdmin), updateUserStatus);

// ─── Admin-Only Routes ────────────────────────────────────────────────────
router.use(requireRole(adminOnly));

// Overview / Metrics
router.get('/metrics', getOrgMetrics);

// Analytics
router.get('/analytics', getOrgAnalytics);

// Access Codes
router.get('/access-codes', getAccessCodes);
router.post('/access-codes', createAccessCode);
router.delete('/access-codes/:codeId', deleteAccessCode);

// Audit Logs
router.get('/audit', getOrgAuditLogs);

// Communications
router.get('/comms', getOrgCommsHistory);
router.post('/comms/broadcast', broadcastOrgNotification);

// Billing
router.get('/billing', getOrgBilling);

// Settings / Profile
router.get('/settings', getOrgSettings);
router.put('/settings', updateOrgSettings);

// Support
router.get('/support', getOrgSupportTickets);
router.post('/support', createOrgSupportTicket);

export default router;
