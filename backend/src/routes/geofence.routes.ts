import { Router } from 'express';
import { updateLocation } from '../controllers/geofence.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Track Volunteer locations
router.post('/location', authenticateJWT, requireRole(['VOLUNTEER']), updateLocation);

export default router;
