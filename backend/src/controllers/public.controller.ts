import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { io } from '../server';

export const getPublicEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const events = await prisma.event.findMany({
      where: {
        // Only return upcoming or active events
        endTime: { gte: new Date() }
      },
      include: {
        organization: { select: { id: true, name: true } },
        _count: { select: { personnel: true } }
      },
      orderBy: { startTime: 'asc' }
    });
    res.json(events);
  } catch (error) {
    console.error('Error fetching public events:', error);
    res.status(500).json({ error: 'Failed to fetch public events' });
  }
};

export const joinEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Check if user is already registered for this event
    const existing = await prisma.eventPersonnel.findFirst({
      where: { eventId, userId }
    });

    if (existing) {
      res.status(400).json({ error: 'Already registered for this event' });
      return;
    }

    // Create EventPersonnel record
    await prisma.eventPersonnel.create({
      data: {
        eventId,
        userId,
        role: 'ATTENDEE'
      }
    });

    // Update user's organizationId if they don't have one, or just update it anyway so they appear in that org's dashboard.
    // For attendees hopping events, this simplistic approach sets their org to the latest event they join.
    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: event.organizationId,
        status: 'ACTIVE' // Mark them active so they appear fully on the roster
      }
    });

    res.json({ success: true, message: 'Successfully registered for event', organizationId: event.organizationId });
  } catch (error) {
    console.error('Error joining event:', error);
    res.status(500).json({ error: 'Failed to join event' });
  }
};

export const getMyTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const registrations = await prisma.eventPersonnel.findMany({
      where: { userId },
      include: {
        event: {
          include: {
            organization: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(registrations);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

export const reportEmergency = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { eventId, lat, lng } = req.body;

    if (!userId || !eventId) {
      res.status(400).json({ error: 'Missing user ID or event ID' });
      return;
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Record the incident in the database
    const incident = await prisma.incident.create({
      data: {
        eventId,
        reporterId: userId,
        category: 'EMERGENCY_SOS',
        description: `SOS activated by Attendee at location: ${lat}, ${lng}`,
        status: 'OPEN'
      }
    });

    // Broadcast high-priority alert to the event's operation room
    io.to(`org_${event.organizationId}`).emit('emergency_alert', {
      incidentId: incident.id,
      userId,
      eventId,
      lat,
      lng,
      timestamp: new Date().toISOString(),
      message: '🚨 SOS EMERGENCY REPORTED BY ATTENDEE 🚨'
    });

    res.json({ success: true, message: 'Emergency reported successfully. Help is on the way.' });
  } catch (error) {
    console.error('Error reporting emergency:', error);
    res.status(500).json({ error: 'Failed to report emergency' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { name, phone, emergencyContact, bloodType } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        phone,
        emergencyContact,
        bloodType
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        emergencyContact: true,
        bloodType: true,
        role: true,
        status: true,
        organizationId: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};
