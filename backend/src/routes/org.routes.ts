import { Router } from 'express';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import {
  getOrgMetrics,
  getOrgEvents, createOrgEvent, updateOrgEvent, deleteOrgEvent,
  getOrgUsers, updateUserStatus,
  getOrgCheckIns, createCheckIn,
  getOrgIncidents, createIncident, updateIncidentStatus,
  getOrgAnalytics,
  getOrgChannels, createOrgChannel, getOrgChannelMembers, addChannelMember, removeChannelMember,
  getOrgAuditLogs,
  getOrgMapData,
  getOrgCommsHistory, broadcastOrgNotification,
  getOrgBilling,
  getOrgSettings, updateOrgSettings,
  getOrgSupportTickets, createOrgSupportTicket,
  getGeoExceptions, grantGeoException, revokeGeoException
} from '../controllers/org.controller';

const router = Router();
router.use(authenticateJWT);
router.use(requireRole(['ORG_ADMIN', 'ROOT_ADMIN']));

// Overview
router.get('/metrics', getOrgMetrics);

// Events
router.get('/events', getOrgEvents);
router.post('/events', createOrgEvent);
router.put('/events/:eventId', updateOrgEvent);
router.delete('/events/:eventId', deleteOrgEvent);

// Users (Attendees + Personnel)
router.get('/users', getOrgUsers);
router.put('/users/:userId', updateUserStatus);

// Check-Ins
router.get('/checkins', getOrgCheckIns);
router.post('/checkins', createCheckIn);

// Incidents
router.get('/incidents', getOrgIncidents);
router.post('/incidents', createIncident);
router.put('/incidents/:incidentId', updateIncidentStatus);

// Analytics
router.get('/analytics', getOrgAnalytics);

// PTT Channels
router.get('/channels', getOrgChannels);
router.post('/channels', createOrgChannel);
router.get('/channels/:channelId/members', getOrgChannelMembers);
router.post('/channels/:channelId/members', addChannelMember);
router.delete('/channels/:channelId/members/:userId', removeChannelMember);

// Geo-fence exceptions
router.get('/geo-exceptions', getGeoExceptions);
router.post('/geo-exceptions', grantGeoException);
router.delete('/geo-exceptions/:eventId/:userId', revokeGeoException);

// Audit Logs
router.get('/audit', getOrgAuditLogs);

// Live Map
router.get('/map', getOrgMapData);

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
