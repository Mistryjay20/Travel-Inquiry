import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Database } from '../db.ts';
import { loginSchema } from '../validation.ts';
import { generateToken, requireAuth, createRateLimiter, AuthRequest } from '../auth.ts';

export const authRouter = Router();

// Rate limiter: 10 attempts per 15 minutes
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many login attempts.',
});

authRouter.post('/login', loginLimiter, (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(', '),
    });
  }

  const { email, password } = result.data;
  const db = Database.getInstance();
  const owner = db.getOwnerByEmail(email);

  if (!owner) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isValid = bcrypt.compareSync(password, owner.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = generateToken(owner.id, owner.email);
  return res.json({
    token,
    user: {
      id: owner.id,
      email: owner.email,
    },
  });
});

authRouter.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  return res.json({
    user: {
      id: req.userId,
      email: req.userEmail,
    },
  });
});

authRouter.post('/logout', requireAuth, (_req: AuthRequest, res: Response) => {
  return res.json({ message: 'Successfully logged out.' });
});
