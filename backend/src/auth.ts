import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Database } from './db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'travel-inquiry-jwt-secret-key-production-safety';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function generateToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
  } catch {
    return null;
  }
}

/**
 * Express middleware to enforce authentication on protected endpoints.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers['x-auth-token']) {
    token = String(req.headers['x-auth-token']);
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
  }

  const db = Database.getInstance();
  const user = db.getOwnerById(payload.userId);
  if (!user) {
    return res.status(401).json({ error: 'Owner account not found.' });
  }

  req.userId = user.id;
  req.userEmail = user.email;
  next();
}

/**
 * In-memory sliding window rate limiter for login and dispatch
 */
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore: Record<string, RateLimitRecord> = {};

export function createRateLimiter(options: { windowMs: number; maxRequests: number; message: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const key = `${req.baseUrl || ''}${req.path}:${ip}`;
    const now = Date.now();

    const record = rateLimitStore[key];
    if (!record || now > record.resetAt) {
      rateLimitStore[key] = {
        count: 1,
        resetAt: now + options.windowMs,
      };
      return next();
    }

    if (record.count >= options.maxRequests) {
      const waitSeconds = Math.ceil((record.resetAt - now) / 1000);
      return res.status(429).json({
        error: `${options.message} Please wait ${waitSeconds}s before trying again.`,
      });
    }

    record.count += 1;
    next();
  };
}
