import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { supabase } from '../supabaseClient';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'senecaone4@gmail.com';

/**
 * Middleware to check if user is admin
 * Must be used after authMiddleware
 */
export async function adminAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Check if user email matches admin email (legacy support)
  if (req.user.email === ADMIN_EMAIL) {
    next();
    return;
  }

  // Check if user has is_admin flag in profiles table
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', req.user.id)
        .single();

      if (!error && data?.is_admin) {
        next();
        return;
      }
    } catch (error) {
      console.error('[adminAuth] Error checking admin status:', error);
    }
  }

  res.status(403).json({ error: 'Forbidden: Admin access required' });
}

