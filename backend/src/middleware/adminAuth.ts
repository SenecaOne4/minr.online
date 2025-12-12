import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'senecaone4@gmail.com';

/**
 * Middleware to check if user is admin
 * Must be used after authMiddleware
 */
export function adminAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Check if user email matches admin email
  if (req.user.email !== ADMIN_EMAIL) {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return;
  }

  next();
}

