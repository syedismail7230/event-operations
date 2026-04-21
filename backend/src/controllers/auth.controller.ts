import { Request, Response } from 'express';
import { admin } from '../lib/firebase-admin';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export const syncFirebaseUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Authorization header missing' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const email = decodedToken.email;

    if (!email) {
      res.status(400).json({ error: 'Email missing from Firebase Token' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (existingUser.status === 'PENDING') {
         res.status(403).json({ error: 'Your account is pending review by the Root Admin.', status: 'PENDING' });
         return;
      }
      res.json({ user: { role: existingUser.role, email: existingUser.email, status: existingUser.status } });
      return;
    }

    const newUser = await prisma.user.create({
      data: {
        email: email,
        password: 'NO_PASSWORD_FIREBASE',
        name: decodedToken.name || 'New Organization Admin',
        role: 'ORG_ADMIN',
        status: 'PENDING'
      }
    });

    res.status(403).json({ error: 'Your account has been created and is pending review by the Root Admin.', status: 'PENDING' });
  } catch (error) {
    console.error('Sync Error', error);
    res.status(500).json({ error: 'Failed to synchronize account' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      process.env.JWT_SECRET || 'super-secret-key-for-dev',
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
};

export const getMe = async (req: any, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, status: true, organizationId: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
};
