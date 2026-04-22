import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import eventRoutes from './routes/event.routes';
import paymentRoutes from './routes/payment.routes';
import geofenceRoutes from './routes/geofence.routes';
import orgRoutes from './routes/org.routes';
import { prismaInitPromise } from './lib/prisma';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

import prisma from './lib/prisma';
const PORT = process.env.PORT || 5000;

// Export io so it can be used in controllers
export { io };

app.use(cors());
app.use(express.json());

// Real-time API traffic tracking
declare global {
  var apiHits: number;
}
global.apiHits = 0;
app.use((req, res, next) => {
  global.apiHits++;
  next();
});

app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/dashboard/org', orgRoutes);
app.use('/event', eventRoutes);
app.use('/payment', paymentRoutes);
app.use('/geofence', geofenceRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Event Operations Platform API is running' });
});

// ─── Point-in-polygon (Ray-casting) ───────────────────────────
function isInsidePolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Track active geo violations to avoid spam: key = userId_eventId
const violationCooldown = new Map<string, number>();
const GEO_ALERT_INTERVAL_MS = 30_000; // alert org every 30s per violation

// In-memory real-time position store: orgId → userId → position
const livePositions = new Map<string, Map<string, { lat: number; lng: number; user: any; updatedAt: string }>>();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_org_room', (orgId: string) => {
    socket.join(`org_${orgId}`);
  });

  socket.on('join_event_room', (eventId: string) => {
    socket.join(`event_${eventId}`);
  });

  // Join a PTT channel room (called when user opens channel)
  socket.on('join_ptt_channel', (channelId: string) => {
    socket.join(`ptt_${channelId}`);
    console.log(`Socket ${socket.id} joined ptt channel: ${channelId}`);
  });

  socket.on('leave_ptt_channel', (channelId: string) => {
    socket.leave(`ptt_${channelId}`);
  });

  // PTT push-to-talk signaling
  socket.on('ptt_acquire', ({ channelId, userId, userName }) => {
    socket.to(`ptt_${channelId}`).emit('ptt_speaking', { userId, userName, socketId: socket.id });
  });

  socket.on('ptt_release', ({ channelId, userId }) => {
    socket.to(`ptt_${channelId}`).emit('ptt_released', { userId });
  });

  // WebRTC SDP signaling — targeted to specific peer
  socket.on('webrtc_offer', ({ channelId, offer, fromId, toSocketId }) => {
    if (toSocketId) {
      io.to(toSocketId).emit('webrtc_offer', { offer, fromId, fromSocketId: socket.id });
    } else {
      socket.to(`ptt_${channelId}`).emit('webrtc_offer', { offer, fromId, fromSocketId: socket.id });
    }
  });

  socket.on('webrtc_answer', ({ channelId, answer, fromId, toSocketId }) => {
    if (toSocketId) {
      io.to(toSocketId).emit('webrtc_answer', { answer, fromId, fromSocketId: socket.id });
    } else {
      socket.to(`ptt_${channelId}`).emit('webrtc_answer', { answer, fromId, fromSocketId: socket.id });
    }
  });

  socket.on('webrtc_ice_candidate', ({ channelId, candidate, fromId, toSocketId }) => {
    if (toSocketId) {
      io.to(toSocketId).emit('webrtc_ice_candidate', { candidate, fromId, fromSocketId: socket.id });
    } else {
      socket.to(`ptt_${channelId}`).emit('webrtc_ice_candidate', { candidate, fromId, fromSocketId: socket.id });
    }
  });

  // ─── GPS Geo-fence Violation Check + Live Position Broadcast ──
  socket.on('location_update', async ({ lat, lng, userId, orgId }: { lat: number; lng: number; userId: string; orgId: string }) => {
    try {
      // Fetch user details for broadcast
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, phone: true, role: true }
      });

      // ─── Update in-memory live position ─────────────────────
      if (!livePositions.has(orgId)) livePositions.set(orgId, new Map());
      livePositions.get(orgId)!.set(userId, { lat, lng, user, updatedAt: new Date().toISOString() });

      // Broadcast real position to all admins watching the org map
      io.to(`org_${orgId}`).emit('user_location', { userId, lat, lng, user, updatedAt: new Date().toISOString() });

      // ─── Geo-fence violation check ───────────────────────────
      const events = await (prisma.event as any).findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, geoBoundary: true }
      });

      // Check each event the user has an active check-in for
      const activeCheckIns = await prisma.eventCheckIn.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        include: { event: { select: { id: true, name: true } } }
      });

      // Latest check-in per event
      const latestByEvent = new Map<string, any>();
      for (const ci of activeCheckIns) {
        if (!latestByEvent.has(ci.eventId)) latestByEvent.set(ci.eventId, ci);
      }

      // Get all geo-fence exceptions for this user
      const exceptions = await (prisma.geoFenceException as any).findMany({
        where: { userId }
      });
      const allowedEventIds = new Set(exceptions.map((e: any) => e.eventId));

      for (const [eventId, ci] of latestByEvent.entries()) {
        if (ci.direction !== 'IN') continue; // Already checked out
        if (allowedEventIds.has(eventId)) continue; // Admin granted exit

        const ev = events.find((e: any) => e.id === eventId);
        if (!ev?.geoBoundary) continue;

        let boundary: [number, number][];
        try { boundary = JSON.parse(ev.geoBoundary); } catch { continue; }
        if (boundary.length < 3) continue;

        const inside = isInsidePolygon([lat, lng], boundary);

        if (!inside) {
          const key = `${userId}_${eventId}`;
          const now = Date.now();
          const lastAlert = violationCooldown.get(key) || 0;

          if (now - lastAlert >= GEO_ALERT_INTERVAL_MS) {
            violationCooldown.set(key, now);

            // Get user details
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { id: true, name: true, email: true, phone: true, role: true }
            });

            io.to(`org_${orgId}`).emit('geo_violation', {
              userId,
              user,
              eventId,
              eventName: ev.name,
              lat,
              lng,
              timestamp: new Date().toISOString(),
              message: `⚠️ ${user?.name} has exited the geo-fence of "${ev.name}"`,
            });
          }
        } else {
          // User came back inside — clear cooldown
          violationCooldown.delete(`${userId}_${eventId}`);
        }
      }
    } catch (err) {
      console.error('[GeoFence] Error processing location update:', err);
    }
  });

  // Return all current live positions when map page requests a snapshot
  socket.on('get_live_positions', (orgId: string) => {
    const positions = livePositions.get(orgId);
    if (positions) {
      socket.emit('live_positions_snapshot', Array.from(positions.values()));
    }
  });

  socket.on('disconnect', () => {
    // Remove user from live positions if socket disconnects
    livePositions.forEach(orgMap => {
      orgMap.forEach((pos, uid) => {
        // We can't easily map socket→userId here without extra tracking,
        // so stale positions expire after 60s on the client side
      });
    });
    console.log('Client disconnected:', socket.id);
  });
});

// Start server immediately — Prisma proxy will connect in background with retry
server.listen(PORT, () => {
  console.log(`Command Center API Online: Port ${PORT}`);
});

// Wait for DB in background, log when ready
prismaInitPromise.then(() => {
  console.log('[Server] Database connection established — all endpoints active.');
});






