import { Router } from 'express';
import { getPublicEvents, joinEvent, getMyTickets, reportEmergency, updateProfile } from '../controllers/public.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Publicly available (no JWT required)
router.get('/events', getPublicEvents);

// Requires Authentication (Attendees)
router.post('/events/:eventId/join', authenticateJWT, joinEvent);
router.get('/tickets', authenticateJWT, getMyTickets);
router.post('/emergency', authenticateJWT, reportEmergency);
router.put('/profile', authenticateJWT, updateProfile);

export default router;
