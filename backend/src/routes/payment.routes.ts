import { Router } from 'express';
import { createOrder, verifyPayment } from '../controllers/payment.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Attendees need to be able to create an order
router.post('/create-order', authenticateJWT, createOrder);
router.post('/verify', authenticateJWT, verifyPayment);

export default router;
