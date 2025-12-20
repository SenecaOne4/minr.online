import { Request, Response, NextFunction } from 'express';
import { supabase } from '../supabaseClient';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error) {
      console.error('[auth] Token validation error:', error.message);
      return res.status(401).json({ error: 'Invalid token', details: error.message });
    }

    if (!user) {
      console.error('[auth] No user returned from token validation');
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    console.log('[auth] User authenticated:', user.email, user.id);
    next();
  } catch (error: any) {
    console.error('[auth] Authentication exception:', error);
    return res.status(401).json({ error: 'Authentication failed', details: error?.message });
  }
}

