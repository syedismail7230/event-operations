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
// QR SCAN CHECK-IN/OUT (Volunteer scans attendee QR)
// Enforces: first scan = IN, second scan = OUT, alternating
// ─────────────────────────────────────────────────────────────
export const qrScanCheckIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const { scannedUserId } = req.body;
    if (!scannedUserId) { res.status(400).json({ error: 'scannedUserId is required.' }); return; }

    // Verify scanned user exists and belongs to this org
    const attendee = await prisma.user.findFirst({
      where: { id: scannedUserId, organizationId: orgId },
      select: { id: true, name: true, email: true }
    });
    if (!attendee) { res.status(404).json({ error: 'Attendee not found in your organization.' }); return; }

    // Find the currently active/upcoming event for this org
    const now = new Date();
    const activeEvent = await prisma.event.findFirst({
      where: {
        organizationId: orgId,
        startTime: { lte: new Date(now.getTime() + 60 * 60 * 1000) }, // within 1 hour of start
        endTime: { gte: now }
      },
      orderBy: { startTime: 'asc' }
    });
    if (!activeEvent) { res.status(400).json({ error: 'No active event found. Check-in is only available during events.' }); return; }

    // Find latest check-in for this user on this event
    const lastCI = await prisma.eventCheckIn.findFirst({
      where: { userId: scannedUserId, eventId: activeEvent.id },
      orderBy: { timestamp: 'desc' }
    });

    // Toggle: if last was IN → record OUT; if last was OUT or none → record IN
    const newDirection = (!lastCI || lastCI.direction === 'OUT') ? 'IN' : 'OUT';

    const checkIn = await prisma.eventCheckIn.create({
      data: { eventId: activeEvent.id, userId: scannedUserId, direction: newDirection },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        event: { select: { id: true, name: true } }
      }
    });

    io.to(`org_${orgId}`).emit('checkin_created', checkIn);

    res.status(201).json({
      message: newDirection === 'IN' ? 'Checked IN successfully' : 'Checked OUT successfully',
      direction: newDirection,
      attendeeName: attendee.name,
      eventName: activeEvent.name,
      checkIn
    });
  } catch (e) {
    console.error('[QRScan] Error:', e);
    res.status(500).json({ error: 'Failed to process QR scan' });
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

export const deleteOrgChannel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { channelId } = req.params;

    // Verify channel belongs to this org
    const channel = await (prisma.communicationChannel as any).findFirst({
      where: { id: channelId, event: { organizationId: orgId! } }
    });
    if (!channel) { res.status(404).json({ error: 'Channel not found.' }); return; }

    // Delete members first, then channel
    await (prisma.channelMember as any).deleteMany({ where: { channelId } });
    await (prisma.communicationChannel as any).delete({ where: { id: channelId } });

    io.to(`org_${orgId}`).emit('channel_deleted', { channelId });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete channel' });
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

export const getOrgNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) { res.status(403).json({ error: 'No organization attached.' }); return; }

    const orgUsers = await prisma.user.findMany({ where: { organizationId: orgId }, select: { id: true } });
    const actorIds = orgUsers.map((u: any) => u.id);

    const logs = await prisma.auditLog.findMany({
      where: { actorId: { in: actorIds }, action: 'BROADCAST_NOTIFICATION' },
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    const notifications = logs.map((l: any) => {
      let parsed: any = {};
      try { parsed = JSON.parse(l.details || '{}'); } catch {}
      return { id: l.id, message: parsed.message, type: parsed.type || 'INFO', targetRole: parsed.targetRole || 'ALL', sentAt: l.createdAt };
    });

    res.json(notifications);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
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

// ─────────────────────────────────────────────────────────────
// EVENT ACCESS CODES (admin creates, volunteer redeems)
// ─────────────────────────────────────────────────────────────

// Generate a short readable code: e.g. HKBK-4829
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `${code}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export const getAccessCodes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const codes = await (prisma.eventAccessCode as any).findMany({
      where: { event: { organizationId: orgId! } },
      include: {
        event: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(codes);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch codes' }); }
};

export const createAccessCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventId, maxUses, expiresAt } = req.body;
    const createdBy = req.user!.id;
    const orgId = req.user?.organizationId;

    // Verify event belongs to org
    const event = await prisma.event.findFirst({ where: { id: eventId, organizationId: orgId! } });
    if (!event) { res.status(404).json({ error: 'Event not found.' }); return; }

    let code = generateCode();
    // Ensure uniqueness
    let attempts = 0;
    while (attempts < 10) {
      const exists = await (prisma.eventAccessCode as any).findUnique({ where: { code } });
      if (!exists) break;
      code = generateCode();
      attempts++;
    }

    const ac = await (prisma.eventAccessCode as any).create({
      data: { code, eventId, createdBy, maxUses: maxUses || 100, expiresAt: expiresAt ? new Date(expiresAt) : null },
      include: { event: { select: { id: true, name: true } } }
    });
    res.status(201).json(ac);
  } catch (e) { res.status(500).json({ error: 'Failed to create code' }); }
};

export const deleteAccessCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { codeId } = req.params;
    await (prisma.eventAccessCode as any).delete({ where: { id: codeId } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete code' }); }
};

// ─── Volunteer redeems a code (no org required, just JWT) ────
export const redeemAccessCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    const userId = req.user!.id;

    if (!code?.trim()) { res.status(400).json({ error: 'Code is required.' }); return; }

    const ac = await (prisma.eventAccessCode as any).findUnique({
      where: { code: code.trim().toUpperCase() },
      include: { event: { select: { id: true, name: true, organizationId: true, startTime: true, endTime: true } } }
    });

    if (!ac) { res.status(404).json({ error: 'Invalid code. Check with your event admin.' }); return; }
    if (ac.usedCount >= ac.maxUses) { res.status(410).json({ error: 'This code has reached its maximum usage limit.' }); return; }
    if (ac.expiresAt && new Date() > new Date(ac.expiresAt)) { res.status(410).json({ error: 'This code has expired.' }); return; }

    // Block privileged users from accidentally downgrading their role
    const PROTECTED_ROLES = ['ORG_ADMIN', 'ROOT_ADMIN', 'MANAGER'];
    if (PROTECTED_ROLES.includes(req.user!.role)) {
      res.status(403).json({ error: 'Admins and managers cannot redeem volunteer access codes.' });
      return;
    }

    // Check if already assigned to this event
    const existing = await prisma.eventPersonnel.findFirst({ where: { eventId: ac.eventId, userId } });
    if (existing) {
      res.json({ success: true, event: ac.event, alreadyAssigned: true });
      return;
    }

    // Assign volunteer to event
    await prisma.eventPersonnel.create({
      data: { eventId: ac.eventId, userId, role: 'VOLUNTEER' }
    });

    // Link volunteer to org — only update role for plain attendees/new users
    const roleToSet = req.user!.role === 'ATTENDEE' ? 'VOLUNTEER' : req.user!.role;
    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: ac.event.organizationId,
        role: roleToSet,
        status: 'ACTIVE'
      }
    });

    // Increment usage count
    await (prisma.eventAccessCode as any).update({
      where: { id: ac.id },
      data: { usedCount: { increment: 1 } }
    });

    await prisma.auditLog.create({
      data: { action: 'VOLUNTEER_JOINED', targetType: 'Event', targetId: ac.eventId, actorId: userId, details: `Joined via access code ${code}` }
    });

    res.json({ success: true, event: ac.event, alreadyAssigned: false });
  } catch (e) {
    console.error('[AccessCode] Redeem error:', e);
    res.status(500).json({ error: 'Failed to redeem code' });
  }
};

