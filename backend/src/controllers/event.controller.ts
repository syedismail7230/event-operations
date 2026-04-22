import { Request, Response } from 'express';

import { io } from '../server';

import prisma from '../lib/prisma';

export const checkInAttendee = async (req: any, res: Response): Promise<void> => {
  try {
    const { eventId, attendeeId, method } = req.body;
    const volunteerId = req.user.id;

    if (!eventId || !attendeeId) {
       res.status(400).json({ error: 'Missing required fields' });
       return;
    }

    // In a real app we'd save this to a CheckIn table. 
    // For now, we simulate the log and emit to WebSockets.
    
    const timestamp = new Date().toISOString();
    
    const checkInPayload = {
      eventId,
      attendeeId,
      volunteerId,
      method: method || 'QR_SCAN',
      timestamp,
      message: `User ${attendeeId.substring(0, 5)} checked in via ${method || 'QR'}`
    };

    // Broadcast to the event room so Managers and Org Admins see it live!
    io.to(`event_${eventId}`).emit('attendee_checked_in', checkInPayload);

    res.json({ success: true, data: checkInPayload });
  } catch (error) {
    res.status(500).json({ error: 'Check-in failed' });
  }
};
