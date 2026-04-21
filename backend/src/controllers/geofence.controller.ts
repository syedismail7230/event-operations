import { Request, Response } from 'express';
import { io } from '../server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MAX_RADIUS_METERS = 500;

function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius of the earth in m
  const dLat = (lat2 - lat1) * (Math.PI/180);  
  const dLon = (lon2 - lon1) * (Math.PI/180); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in m
  return d;
}

export const updateLocation = async (req: any, res: Response): Promise<void> => {
  try {
    const { eventId, lat, lng } = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    if (role !== 'VOLUNTEER') {
       res.json({ success: true, tracking: false });
       return;
    }

    // Fetch live coordinates from DB
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    
    if (!event || event.latitude === null || event.longitude === null) {
       res.status(400).json({ error: "Event GPS coordinates not configured" });
       return;
    }

    const distance = getDistanceFromLatLonInM(event.latitude, event.longitude, lat, lng);

    if (distance > MAX_RADIUS_METERS) {
       // Breach detected! Broadcast to Managers and Admins
       io.to(`event_${eventId}`).emit('geofence_breach', {
         userId,
         distance: Math.round(distance),
         timestamp: new Date().toISOString(),
         message: `Volunteer ${userId.substring(0, 5)} exited geofence (${Math.round(distance)}m away).`
       });
    }

    res.json({ success: true, tracking: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update location' });
  }
};
