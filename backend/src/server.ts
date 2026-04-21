import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import eventRoutes from './routes/event.routes';
import paymentRoutes from './routes/payment.routes';
import geofenceRoutes from './routes/geofence.routes';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Export io so it can be used in controllers
export { io };

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/event', eventRoutes);
app.use('/payment', paymentRoutes);
app.use('/geofence', geofenceRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Event Operations Platform API is running' });
});

io.on('connection', (socket) => {
  console.log('Client connected via WebSocket:', socket.id);
  
  socket.on('join_event_room', (eventId) => {
    socket.join(`event_${eventId}`);
    console.log(`Socket ${socket.id} joined room event_${eventId}`);
  });

  // WebRTC Push-To-Talk Signaling
  socket.on('webrtc_offer', ({ eventId, offer, volunteerId }) => {
     // Broadcast voice offer to all others in the event room
     socket.to(`event_${eventId}`).emit('webrtc_offer', { offer, volunteerId });
  });

  socket.on('webrtc_answer', ({ eventId, answer, volunteerId }) => {
     socket.to(`event_${eventId}`).emit('webrtc_answer', { answer, volunteerId });
  });

  socket.on('webrtc_ice_candidate', ({ eventId, candidate }) => {
     socket.to(`event_${eventId}`).emit('webrtc_ice_candidate', candidate);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server & WebSocket are running on port ${PORT}`);
});
