import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';
import os from 'os';

const prisma = new PrismaClient() as any;
import { io } from '../server';

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
      .filter((ev: any) => ev.latitude && ev.longitude)
      .map((ev: any) => ({
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

export const getOrganizationDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: true,
        events: true
      }
    });
    
    // Explicitly grab the nested subscription dynamically to avoid crashing the server if the user hasn't generated the schema yet
    let sub = null;
    try {
      sub = await prisma.subscription.findUnique({ where: { organizationId: id } });
    } catch(err) { /* schema hasn't updated yet */ }

    if (!org) { res.status(404).json({ error: 'Tenant not found' }); return; }
    res.json({ ...org, subscriptionId: sub?.id || org.subscriptionId });
  } catch(e) {
    res.status(500).json({ error: 'Failed' });
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

// ==========================================
// PHASE 3: ZERO-MOCK TELEMETRY IMPLEMENTATION
// ==========================================

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Audit Logs' });
  }
};

export const getFeatureToggles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const features = await prisma.featureToggle.findMany();
    res.json(features);
  } catch(e) {
    res.status(500).json({ error: 'Failed to fetch features' });
  }
};

export const toggleFeature = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { key, isEnabled } = req.body;
    const toggled = await prisma.featureToggle.upsert({
      where: { key },
      update: { isEnabled },
      create: { key, isEnabled, description: `Dynamic trigger for ${key}` }
    });
    // Physically broadcast toggle state to all active client streams
    io.emit('feature_toggle_sync', { key, isEnabled });
    res.json({ success: true, feature: toggled });
  } catch(e) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const getSubscriptions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subs: any[] = await prisma.subscription.findMany();
    const orgs: any[] = await prisma.organization.findMany({
      where: { id: { in: subs.map((s: any) => s.organizationId) } }
    });
    
    const mappedSubs = subs.map((sub: any) => {
      const org = orgs.find((o: any) => o.id === sub.organizationId);
      return { ...sub, organization: org ? { name: org.name } : null };
    });
    
    res.json(mappedSubs);
  } catch(e) {
    res.status(500).json({ error: 'Failed fetching subs' });
  }
};

export const emergencyHaltEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventId } = req.body;
    // Log the action legally in the AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'EMERGENCY_HALT',
        targetType: 'EVENT',
        targetId: eventId,
        actorId: req.user?.id || 'SYSTEM'
      }
    });
    
    // Physically override 1000+ localized react clients sitting in that event room
    io.to(`event_${eventId}`).emit('EMERGENCY_HALT', { message: 'NOC Directive: Terminate Operations' });
    
    res.json({ success: true, message: 'Broadcast intercept fired' });
  } catch(error) {
    res.status(500).json({ error: 'Failed event halt' });
  }
};

// ==========================================
// PHASE 4: THE FINAL CORE SWEEP
// ==========================================

export const getSupportTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tickets: any[] = await prisma.supportTicket.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(tickets);
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
};

export const getSystemNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifs: any[] = await prisma.systemNotification.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(notifs);
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
};

export const broadcastNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { message, type } = req.body;
    const notif = await prisma.systemNotification.create({ data: { message, type } });
    io.emit('global_notification', notif);
    res.json(notif);
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
};

export const getSecurityEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const logs: any[] = await prisma.auditLog.findMany({
      where: { action: { in: ['FORCE_LOGOUT', 'SUSPENDED', 'ROLE_MUTATION'] } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(logs);
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
};

export const getPlatformSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings: any[] = await prisma.globalPlatformConfig.findMany();
    res.json(settings);
  } catch(e) { res.status(500).json({ error: 'Failed' }); }
};

export const getSystemHealthLayer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    
    res.json({
      status: 'OPERATIONAL',
      dbLatencyMs: latency,
      freeMemoryBytes: os.freemem(),
      totalMemoryBytes: os.totalmem(),
      uptimeSeconds: os.uptime()
    });
  } catch(e) {
    res.status(500).json({ error: 'Health Check Failed' });
  }
};

export const getPublicEvents = async (req: any, res: Response): Promise<void> => {
  try {
    const events: any[] = await prisma.event.findMany({
      include: { organization: true },
      orderBy: { startTime: 'desc' }
    });
    res.json(events);
  } catch(e) { res.status(500).json({ error: 'Failed to fetch public events' }); }
};
