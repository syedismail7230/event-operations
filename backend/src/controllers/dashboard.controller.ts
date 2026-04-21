import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';
import os from 'os';

const prisma = new PrismaClient();

export const getRootMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activeEventsCount = await prisma.event.count();
    const activeUsersCount = await prisma.user.count({ where: { status: 'ACTIVE' } });
    const activeOrgsCount = await prisma.organization.count();

    const organizations = await prisma.organization.findMany({
      include: {
        _count: {
          select: { users: true, events: true }
        }
      }
    });

    const activeEventsList = await prisma.event.findMany({
      include: {
        organization: { select: { name: true } }
      },
      orderBy: { startTime: 'desc' },
      take: 20
    });

    const attendees = await prisma.user.findMany({
      where: { role: 'ATTENDEE' },
      select: { id: true, name: true, email: true }
    });

    const pendingCount = await prisma.user.count({ where: { status: 'PENDING' } });

    // Live Hardware Telemetry
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus().length;
    const loadAvg = os.loadavg()[0];
    const cpuPercent = Math.min(100, Math.round((loadAvg / cpus) * 100));

    const systemLoad = {
      cpu: `${cpuPercent}%`,
      memory: `${(usedMem / 1024 / 1024 / 1024).toFixed(1)}GB / ${(totalMem / 1024 / 1024 / 1024).toFixed(1)}GB`,
      apiHits: global.apiHits || 0
    };

    // Strict No-Mock Policy: User density is strictly real. 
    // Since users don't have persistent GPS columns tracked in DB yet, we natively pull the 
    // geofence centers of ALL absolutely live events directly from database to populate the map.
    const mapNodes = activeEventsList
      .filter(ev => ev.latitude && ev.longitude)
      .map(ev => ({
        id: ev.id,
        name: ev.name,
        type: 'event',
        lat: ev.latitude,
        lng: ev.longitude
      }));

    res.json({
      activeEvents: activeEventsCount,
      activeUsers: activeUsersCount,
      totalOrgs: activeOrgsCount,
      systemAlerts: pendingCount, 
      organizations,
      events: activeEventsList,
      systemLoad,
      mapNodes
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

    const events = await prisma.event.findMany({
      where: { organizationId: orgId },
      orderBy: { startTime: 'asc' }
    });

    const totalAttendees = await prisma.user.count({
      where: { organizationId: orgId, role: 'ATTENDEE' }
    });

    const totalVolunteers = await prisma.user.count({
      where: { organizationId: orgId, role: 'VOLUNTEER' }
    });

    const personnelList = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, email: true, role: true, status: true }
    });

    res.json({
      activeEvents: events.length,
      totalAttendees,
      totalVolunteers,
      events,
      personnel: personnelList,
      reports: [] // Strict No Mock Policy.
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch org metrics' });
  }
};

export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      include: {
        organization: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch global user registry' });
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

export const suspendOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orgId, status } = req.body;
    
    await prisma.organization.update({
      where: { id: orgId },
      data: { status }
    });

    if (status === 'SUSPENDED') {
      await prisma.user.updateMany({
        where: { organizationId: orgId, role: { not: 'ROOT_ADMIN' } },
        data: { status: 'SUSPENDED' }
      });
    } else if (status === 'ACTIVE') {
      await prisma.user.updateMany({
        where: { organizationId: orgId, role: { not: 'ROOT_ADMIN' } },
        data: { status: 'ACTIVE' }
      });
    }
    
    res.json({ success: true, message: `Organization status set to ${status}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update organization status' });
  }
};

export const modifyUserIAM = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, action, role } = req.body;
    
    if (action === 'FORCE_LOGOUT' || action === 'SUSPEND') {
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'SUSPENDED' }
      });
    } else if (action === 'CHANGE_ROLE' && role) {
      await prisma.user.update({
        where: { id: userId },
        data: { role }
      });
    } else if (action === 'ACTIVATE') {
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE' }
      });
    }
    
    res.json({ success: true, message: `User IAM modified: ${action}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to modify User IAM' });
  }
};
