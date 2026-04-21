import { Router } from 'express';
import { checkInAttendee } from '../controllers/event.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Only Volunteers and Managers can check people in
router.post('/check-in', authenticateJWT, requireRole(['VOLUNTEER', 'MANAGER']), checkInAttendee);

export default router;
