import { Request, Response, NextFunction } from 'express';
import { admin } from '../lib/firebase-admin';

// JWT_SECRET is no longer needed locally as firebase handles it

export interface AuthRequest extends Request {
  user?: { id: string; role: string; organizationId: string | null };
}

export const authenticateJWT = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      // Retrieve user from DB to inject RBAC role
      // Mocked here since DB fetch requires Prisma client import
      req.user = { id: decodedToken.uid, role: 'ATTENDEE', organizationId: null };
      next();
    } catch (err) {
      res.status(403).json({ error: 'Invalid or expired Firebase token' });
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
