import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getRootMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Execute live aggregations across all tenants
    const activeEventsCount = await prisma.event.count();
    const activeUsersCount = await prisma.user.count();
    const activeOrgsCount = await prisma.organization.count();

    // System alerts triggered naturally in a real platform, mock zeroing unless tracked
    const systemAlerts = 0;

    res.json({
      activeEvents: activeEventsCount,
      activeUsers: activeUsersCount,
      systemAlerts: systemAlerts,
      totalOrgs: activeOrgsCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch root metrics' });
  }
};

export const getOrgMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ error: 'Organization ID missing' });
      return;
    }

    // Fetch resources mapped to this specific org ID
    const events = await prisma.event.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, startTime: true, endTime: true }
    });

    const activeEvents = events.length;
    const totalAttendees = await prisma.user.count({
      where: { organizationId: orgId, role: 'ATTENDEE' }
    });
    const checkedIn = 0; // Requires actual CheckIn model to count precisely

    res.json({
      activeEvents,
      totalAttendees,
      checkedIn,
      recentActivity: [] // Websockets will push live streams into this array on the frontend
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch org metrics' });
  }
};

export const getPendingUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pendingUsers = await prisma.user.findMany({
      where: { status: 'PENDING' },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending users' });
  }
};

export const approveUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' }
    });
    res.json({ success: true, message: 'User approved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve user' });
  }
};
