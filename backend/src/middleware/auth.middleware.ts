import { Request, Response, NextFunction } from 'express';
import { admin } from '../lib/firebase-admin';
import jwt from 'jsonwebtoken';


import prisma from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: { id: string; role: string; organizationId: string | null };
}

export const authenticateJWT = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    try {
      // 1. Try resolving Local JWT
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key-for-dev') as any;
        req.user = { id: decoded.id, role: decoded.role, organizationId: decoded.organizationId };
        return next();
      } catch (jwtErr) {
        // Fallthrough if it's not a local JSON token
      }

      // 2. Try resolving Firebase OAuth Token
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      if (!decodedToken.email) {
         res.status(400).json({ error: 'Firebase token missing email scope' });
         return;
      }

      const dbUser = await prisma.user.findUnique({
        where: { email: decodedToken.email }
      });

      if (!dbUser) {
        res.status(403).json({ error: 'Sync pipeline incomplete; user missing in DB' });
        return;
      }

      req.user = { id: dbUser.id, role: dbUser.role, organizationId: dbUser.organizationId };
      next();
    } catch (err) {
      res.status(403).json({ error: 'Invalid or expired authentication token' });
    }
  } else {
    res.status(401).json({ error: 'Authorization header missing' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Access denied: insufficient role privileges' });
      return;
    }

    next();
  };
};
