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
    console.error('[adminAuth] No user in request');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  console.log('[adminAuth] Checking admin access for user:', req.user.email, req.user.id);

  // Check if user email matches admin email (legacy support)
  if (req.user.email === ADMIN_EMAIL) {
    console.log('[adminAuth] User authorized via email match');
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

      if (error) {
        console.error('[adminAuth] Error fetching profile:', error);
      } else if (data?.is_admin) {
        console.log('[adminAuth] User authorized via is_admin flag');
        next();
        return;
      } else {
        console.log('[adminAuth] User does not have is_admin flag:', data);
      }
    } catch (error) {
      console.error('[adminAuth] Error checking admin status:', error);
    }
  } else {
    console.error('[adminAuth] Supabase not configured');
  }

  console.error('[adminAuth] Access denied for user:', req.user.email);
  res.status(403).json({ error: 'Forbidden: Admin access required' });
}

