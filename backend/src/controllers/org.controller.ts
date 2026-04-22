import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { io } from '../server';

// ─────────────────────────────────────────────────────────────
// ORG OVERVIEW METRICS
// ─────────────────────────────────────────────────────────────
export const getOrgMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const [activeEvents, totalAttendees, totalVolunteers, pendingCount, events, personnel] = await Promise.all([
      prisma.event.count({ where: { organizationId: orgId } }),
      prisma.user.count({ where: { organizationId: orgId, role: 'USER', status: 'ACTIVE' } }),
      prisma.user.count({ where: { organizationId: orgId, role: 'VOLUNTEER', status: 'ACTIVE' } }),
      prisma.user.count({ where: { organizationId: orgId, status: 'PENDING' } }),
      prisma.event.findMany({
        where: { organizationId: orgId },
        orderBy: { startTime: 'desc' },
        take: 5
      }),
      prisma.user.findMany({
        where: { organizationId: orgId, role: { in: ['VOLUNTEER', 'MANAGER'] } },
        take: 6,
        orderBy: { createdAt: 'desc' }
      }),
    ]);

    res.json({ activeEvents, totalAttendees, totalVolunteers, pendingCount, events, personnel });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch org metrics' });
  }
};

// ─────────────────────────────────────────────────────────────
// EVENT MANAGEMENT
// ─────────────────────────────────────────────────────────────
export const getOrgEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const events = await prisma.event.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { checkIns: true, incidents: true, personnel: true } }
      },
      orderBy: { startTime: 'desc' }
    });
    res.json(events);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
};

export const createOrgEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const { name, description, startTime, endTime, latitude, longitude, geoBoundary } = req.body;
    const event = await prisma.event.create({
      data: {
        name,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        geoBoundary: geoBoundary || null,
        organizationId: orgId
      } as any
    });

    // Broadcast to all org sockets
    io.to(`org_${orgId}`).emit('event_created', event);

    await prisma.auditLog.create({
      data: {
        action: 'EVENT_CREATED',
        targetType: 'Event',
        targetId: event.id,
        actorId: req.user!.id,
        details: `Created event: ${name}`
      }
    });

    res.status(201).json(event);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create event' });
  }
};

export const updateOrgEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const eventId = req.params.eventId as string;

    const existing = await prisma.event.findFirst({ where: { id: eventId, organizationId: orgId! } });
    if (!existing) { res.status(404).json({ error: 'Event not found.' }); return; }

    const { name, description, startTime, endTime, latitude, longitude, geoBoundary } = req.body;
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (startTime !== undefined) updateData.startTime = new Date(startTime);
    if (endTime !== undefined) updateData.endTime = new Date(endTime);
    if (latitude !== undefined) updateData.latitude = latitude ? parseFloat(String(latitude)) : null;
    if (longitude !== undefined) updateData.longitude = longitude ? parseFloat(String(longitude)) : null;
    if (geoBoundary !== undefined) updateData.geoBoundary = geoBoundary || null;

    const updated = await prisma.event.update({ where: { id: eventId }, data: updateData });
    io.to(`org_${orgId}`).emit('event_updated', updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update event' });
  }
};

export const deleteOrgEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const eventId = req.params.eventId as string;

    const existing = await prisma.event.findFirst({ where: { id: eventId, organizationId: orgId! } });
    if (!existing) { res.status(404).json({ error: 'Event not found.' }); return; }

    await prisma.event.delete({ where: { id: eventId } });
    io.to(`org_${orgId}`).emit('event_deleted', { id: eventId });
    res.json({ message: 'Event archived successfully.' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to archive event' });
  }
};

// ─────────────────────────────────────────────────────────────
// ATTENDEES & PERSONNEL
// ─────────────────────────────────────────────────────────────
export const getOrgUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const users = await prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.params.userId as string;
    const { status, role } = req.body;

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || targetUser.organizationId !== orgId) {
      res.status(404).json({ error: 'User not found in your organization.' }); return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: status || targetUser.status,
        role: role || targetUser.role
      }
    });

    io.to(`org_${orgId}`).emit('user_updated', updatedUser);

    await prisma.auditLog.create({
      data: {
        action: status ? `USER_STATUS_${status}` : `USER_ROLE_${role}`,
        targetType: 'User',
        targetId: userId,
        actorId: req.user!.id,
        details: `Updated ${targetUser.name}: status=${status || '-'} role=${role || '-'}`
      }
    });

    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// ─────────────────────────────────────────────────────────────
// CHECK-IN / CHECK-OUT
// ─────────────────────────────────────────────────────────────
export const getOrgCheckIns = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const orgEvents = await prisma.event.findMany({
      where: { organizationId: orgId },
      select: { id: true }
    });
    const eventIds = orgEvents.map((e: any) => e.id);

    const checkIns = await prisma.eventCheckIn.findMany({
      where: { eventId: { in: eventIds } },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        event: { select: { id: true, name: true } }
      },
      orderBy: { timestamp: 'desc' },
      take: 200
    });
    res.json(checkIns);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
};

export const createCheckIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { eventId, userId, direction } = req.body;

    const event = await prisma.event.findFirst({ where: { id: eventId, organizationId: orgId! } });
    if (!event) { res.status(404).json({ error: 'Event not found in your org.' }); return; }

    const checkIn = await prisma.eventCheckIn.create({
      data: { eventId, userId, direction: direction || 'IN' },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        event: { select: { id: true, name: true } }
      }
    });

    io.to(`org_${orgId}`).emit('checkin_created', checkIn);
    io.to(`event_${eventId}`).emit('checkin_created', checkIn);

    res.status(201).json(checkIn);
  } catch (e) {
    res.status(500).json({ error: 'Failed to record check-in' });
  }
};

// ─────────────────────────────────────────────────────────────
// INCIDENTS
// ─────────────────────────────────────────────────────────────
export const getOrgIncidents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const orgEvents = await prisma.event.findMany({
      where: { organizationId: orgId },
      select: { id: true }
    });
    const eventIds = orgEvents.map((e: any) => e.id);

    const incidents = await prisma.incident.findMany({
      where: { eventId: { in: eventIds } },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        event: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(incidents);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
};

export const createIncident = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { eventId, category, description } = req.body;

    const event = await prisma.event.findFirst({ where: { id: eventId, organizationId: orgId! } });
    if (!event) { res.status(404).json({ error: 'Event not found in your org.' }); return; }

    const incident = await prisma.incident.create({
      data: { eventId, reporterId: req.user!.id, category, description },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        event: { select: { id: true, name: true } }
      }
    });

    io.to(`org_${orgId}`).emit('incident_created', incident);
    res.status(201).json(incident);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create incident' });
  }
};

export const updateIncidentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const incidentId = req.params.incidentId as string;
    const { status } = req.body;

    const updated = await prisma.incident.update({
      where: { id: incidentId },
      data: { status },
      include: {
        reporter: { select: { id: true, name: true } },
        event: { select: { id: true, name: true } }
      }
    });

    io.to(`org_${orgId}`).emit('incident_updated', updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update incident' });
  }
};

// ─────────────────────────────────────────────────────────────
// ANALYTICS (real aggregation)
// ─────────────────────────────────────────────────────────────
export const getOrgAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const orgEvents = await prisma.event.findMany({
      where: { organizationId: orgId },
      select: { id: true }
    });
    const eventIds = orgEvents.map((e: any) => e.id);

    const [totalCheckIns, checkOuts, openIncidents, resolvedIncidents, allCheckIns] = await Promise.all([
      prisma.eventCheckIn.count({ where: { eventId: { in: eventIds }, direction: 'IN' } }),
      prisma.eventCheckIn.count({ where: { eventId: { in: eventIds }, direction: 'OUT' } }),
      prisma.incident.count({ where: { eventId: { in: eventIds }, status: 'OPEN' } }),
      prisma.incident.count({ where: { eventId: { in: eventIds }, status: 'RESOLVED' } }),
      prisma.eventCheckIn.findMany({
        where: { eventId: { in: eventIds } },
        orderBy: { timestamp: 'asc' }
      })
    ]);

    // Build 7-day trend buckets
    const now = new Date();
    const trend: { day: string; checkins: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const count = allCheckIns.filter((c: any) => {
        const cd = new Date(c.timestamp);
        return cd.toDateString() === d.toDateString() && c.direction === 'IN';
      }).length;
      trend.push({ day: label, checkins: count });
    }

    res.json({
      totalCheckIns,
      checkOuts,
      currentlyInside: totalCheckIns - checkOuts,
      openIncidents,
      resolvedIncidents,
      trend
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

// ─────────────────────────────────────────────────────────────
// PTT CHANNELS
// ─────────────────────────────────────────────────────────────
export const getOrgChannels = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const orgEvents = await prisma.event.findMany({
      where: { organizationId: orgId },
      select: { id: true }
    });
    const eventIds = orgEvents.map((e: any) => e.id);

    const channels = await prisma.communicationChannel.findMany({
      where: { eventId: { in: eventIds } },
      include: { event: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(channels);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
};

export const createOrgChannel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { eventId, name, memberIds } = req.body; // memberIds: string[]

    const event = await prisma.event.findFirst({ where: { id: eventId, organizationId: orgId! } });
    if (!event) { res.status(404).json({ error: 'Event not found.' }); return; }

    const channel = await (prisma.communicationChannel as any).create({
      data: {
        eventId,
        name,
        members: memberIds?.length ? {
          create: memberIds.map((userId: string) => ({ userId }))
        } : undefined
      },
      include: {
        event: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true, role: true } } } }
      }
    });

    io.to(`org_${orgId}`).emit('channel_created', channel);
    res.status(201).json(channel);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create channel' });
  }
};

export const getOrgChannelMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { channelId } = req.params;
    const channel = await (prisma.communicationChannel as any).findFirst({
      where: { id: channelId, event: { organizationId: orgId! } },
      include: { members: { include: { user: { select: { id: true, name: true, role: true, email: true } } } } }
    });
    if (!channel) { res.status(404).json({ error: 'Channel not found.' }); return; }
    res.json(channel.members);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
};

export const addChannelMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params;
    const { userId } = req.body;
    const member = await (prisma.channelMember as any).create({
      data: { channelId, userId },
      include: { user: { select: { id: true, name: true, role: true } } }
    });
    res.status(201).json(member);
  } catch (e: any) {
    if (e.code === 'P2002') { res.status(409).json({ error: 'User already in channel.' }); return; }
    res.status(500).json({ error: 'Failed to add member' });
  }
};

export const removeChannelMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { channelId, userId } = req.params;
    await (prisma.channelMember as any).deleteMany({ where: { channelId, userId } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
};

// ─────────────────────────────────────────────────────────────
// GEO-FENCE EXCEPTIONS
// ─────────────────────────────────────────────────────────────
export const getGeoExceptions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const exceptions = await (prisma.geoFenceException as any).findMany({
      where: { event: { organizationId: orgId! } },
      include: {
        subject: { select: { id: true, name: true, email: true, role: true } },
        event: { select: { id: true, name: true } },
        granter: { select: { id: true, name: true } }
      },
      orderBy: { grantedAt: 'desc' }
    });
    res.json(exceptions);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch exceptions' });
  }
};

export const grantGeoException = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, eventId, reason } = req.body;
    const grantedBy = req.user!.id;

    const ex = await (prisma.geoFenceException as any).upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, grantedBy, reason },
      update: { grantedBy, reason, grantedAt: new Date() },
      include: {
        subject: { select: { id: true, name: true } },
        event: { select: { id: true, name: true } }
      }
    });

    // Emit to org so violation alerts stop
    const orgId = req.user?.organizationId;
    io.to(`org_${orgId}`).emit('geo_exception_granted', {
      userId, eventId, userName: ex.subject.name, eventName: ex.event.name
    });

    res.json(ex);
  } catch (e) {
    res.status(500).json({ error: 'Failed to grant exception' });
  }
};

export const revokeGeoException = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, eventId } = req.params;
    await (prisma.geoFenceException as any).deleteMany({ where: { userId, eventId } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to revoke exception' });
  }
};

// ─────────────────────────────────────────────────────────────
// AUDIT LOGS (org level)
// ─────────────────────────────────────────────────────────────
export const getOrgAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    // Get all user IDs in this org
    const orgUsers = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: { id: true }
    });
    const actorIds = orgUsers.map((u: any) => u.id);

    const logs = await prisma.auditLog.findMany({
      where: { actorId: { in: actorIds } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

// ─────────────────────────────────────────────────────────────
// LIVE MAP DATA
// ─────────────────────────────────────────────────────────────
export const getOrgMapData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const events = await prisma.event.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, latitude: true, longitude: true, geoBoundary: true, startTime: true, endTime: true } as any
    });

    const eventIds = events.map((e: any) => e.id);

    // Most recent check-in per user across org events (to determine current location)
    const recentCheckIns = await prisma.eventCheckIn.findMany({
      where: { eventId: { in: eventIds } },
      include: { user: { select: { id: true, name: true, role: true } }, event: { select: { id: true, name: true } } },
      orderBy: { timestamp: 'desc' },
      take: 200
    });

    // Deduplicate — keep only the latest check-in per user
    const seen = new Set<string>();
    const latestPerUser = recentCheckIns.filter((ci: any) => {
      if (seen.has(ci.userId)) return false;
      seen.add(ci.userId);
      return true;
    });

    // Users currently inside (last action was IN)
    const insideUsers = latestPerUser.filter((ci: any) => ci.direction === 'IN');

    res.json({ events, insideUsers });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
};

// ─────────────────────────────────────────────────────────────
// COMMUNICATIONS — Broadcast to org users
// ─────────────────────────────────────────────────────────────
export const getOrgCommsHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const orgUsers = await prisma.user.findMany({ where: { organizationId: orgId }, select: { id: true } });
    const actorIds = orgUsers.map((u: any) => u.id);

    const logs = await prisma.auditLog.findMany({
      where: { actorId: { in: actorIds }, action: 'BROADCAST_NOTIFICATION' },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch comms history' });
  }
};

export const broadcastOrgNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const { message, targetRole, type } = req.body; // type: INFO, URGENT
    if (!message?.trim()) { res.status(400).json({ error: 'Message is required.' }); return; }

    // Persist as audit entry
    const log = await prisma.auditLog.create({
      data: {
        action: 'BROADCAST_NOTIFICATION',
        targetType: 'Organization',
        targetId: orgId,
        actorId: req.user!.id,
        details: JSON.stringify({ message, targetRole: targetRole || 'ALL', type: type || 'INFO' })
      }
    });

    // Emit to all connected org sockets
    io.to(`org_${orgId}`).emit('org_notification', {
      id: log.id,
      message,
      targetRole: targetRole || 'ALL',
      type: type || 'INFO',
      sentAt: log.createdAt,
      sentBy: req.user!.id
    });

    res.json({ success: true, log });
  } catch (e) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
};

// ─────────────────────────────────────────────────────────────
// BILLING / SUBSCRIPTION
// ─────────────────────────────────────────────────────────────
export const getOrgBilling = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const subscription = await (prisma.subscription as any).findUnique({ where: { organizationId: orgId } });
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true, createdAt: true } });
    const eventCount = await prisma.event.count({ where: { organizationId: orgId } });
    const userCount = await prisma.user.count({ where: { organizationId: orgId } });

    res.json({ subscription, org, eventCount, userCount });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch billing info' });
  }
};

// ─────────────────────────────────────────────────────────────
// PROFILE / ORG SETTINGS
// ─────────────────────────────────────────────────────────────
export const getOrgSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) { res.status(403).json({ error: 'Unauthorized' }); return; }

    const [org, user] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, phone: true, role: true } })
    ]);
    res.json({ org, user });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

export const updateOrgSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) { res.status(403).json({ error: 'Unauthorized' }); return; }

    const { orgName, name, phone } = req.body;

    const [org, user] = await Promise.all([
      orgName ? prisma.organization.update({ where: { id: orgId }, data: { name: orgName } }) : prisma.organization.findUnique({ where: { id: orgId } }),
      prisma.user.update({
        where: { id: userId },
        data: {
          ...(name ? { name } : {}),
          ...(phone !== undefined ? { phone } : {})
        },
        select: { id: true, name: true, email: true, phone: true, role: true }
      })
    ]);

    await prisma.auditLog.create({
      data: { action: 'PROFILE_UPDATED', targetType: 'User', targetId: userId, actorId: userId, details: 'Profile/org settings updated' }
    });

    res.json({ org, user });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

// ─────────────────────────────────────────────────────────────
// SUPPORT TICKETS
// ─────────────────────────────────────────────────────────────
export const getOrgSupportTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const tickets = await (prisma.supportTicket as any).findMany({
      where: { tenantId: orgId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tickets);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch support tickets' });
  }
};

export const createOrgSupportTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const { subject, priority } = req.body;
    const ticket = await (prisma.supportTicket as any).create({
      data: { tenantId: orgId, subject, priority: priority || 'LOW' }
    });
    res.status(201).json(ticket);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create ticket' });
  }
};
