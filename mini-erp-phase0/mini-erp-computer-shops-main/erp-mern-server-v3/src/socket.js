import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from './config/logger.js';

let io;

export const initSocket = (httpServer) => {
  const origins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        const isAllowed =
          !origin || process.env.NODE_ENV !== 'production' || origins.includes(origin) || origins.includes('*');
        callback(null, isAllowed ? true : false);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Middleware for Authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.logSuccess(`User connected: ${socket.user?.id}`, {
      role: socket.user?.role,
      socketId: socket.id,
    });

    // Join room based on user ID for personal notifications
    if (socket.user?.id) {
      socket.join(socket.user.id);
    }

    // Join room based on role for group notifications
    if (socket.user?.role) {
      socket.join(socket.user.role); // e.g., 'admin', 'manager'
    }

    socket.on('disconnect', () => {
      logger.info('User disconnected', { userId: socket.user?.id, socketId: socket.id });
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

/**
 * Send notification to specific user or role
 * @param {string|string[]} recipients - User ID(s) or Role(s)
 * @param {object} data - Notification payload { title, message, type }
 */
export const sendNotification = (recipients, data) => {
  if (!io) return;

  const payload = {
    ...data,
    timestamp: new Date(),
  };

  if (Array.isArray(recipients)) {
    recipients.forEach((r) => io.to(r).emit('notification', payload));
  } else {
    io.to(recipients).emit('notification', payload);
  }
};
