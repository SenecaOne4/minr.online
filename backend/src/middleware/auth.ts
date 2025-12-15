import { Request, Response, NextFunction } from 'express';
import { supabase } from '../supabaseClient';
import { appendFileSync } from 'fs';

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
  // #region agent log
  try{appendFileSync('/Users/seneca/Desktop/minr.online/.cursor/debug.log',JSON.stringify({location:'auth.ts:11',message:'Auth middleware entry',data:{path:req.path,method:req.method},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
  // #endregion
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // #region agent log
    try{appendFileSync('/Users/seneca/Desktop/minr.online/.cursor/debug.log',JSON.stringify({location:'auth.ts:19',message:'Missing auth header',data:{hasHeader:!!authHeader,startsWithBearer:authHeader?.startsWith('Bearer ')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
    // #endregion
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);
  // #region agent log
  try{appendFileSync('/Users/seneca/Desktop/minr.online/.cursor/debug.log',JSON.stringify({location:'auth.ts:23',message:'Token extracted',data:{tokenLength:token.length,tokenPrefix:token.substring(0,20)+'...'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
  // #endregion

  if (!supabase) {
    // #region agent log
    try{appendFileSync('/Users/seneca/Desktop/minr.online/.cursor/debug.log',JSON.stringify({location:'auth.ts:26',message:'Supabase not configured',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n');}catch(e){}
    // #endregion
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    // #region agent log
    try{appendFileSync('/Users/seneca/Desktop/minr.online/.cursor/debug.log',JSON.stringify({location:'auth.ts:32',message:'Before getUser call',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
    // #endregion
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    // #region agent log
    try{appendFileSync('/Users/seneca/Desktop/minr.online/.cursor/debug.log',JSON.stringify({location:'auth.ts:37',message:'After getUser call',data:{hasUser:!!user,hasError:!!error,errorMessage:error?.message,userId:user?.id,userEmail:user?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
    // #endregion

    if (error) {
      console.error('[auth] Token validation error:', error.message);
      // #region agent log
      try{appendFileSync('/Users/seneca/Desktop/minr.online/.cursor/debug.log',JSON.stringify({location:'auth.ts:40',message:'Token validation error',data:{errorMessage:error.message,errorCode:error.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
      // #endregion
      return res.status(401).json({ error: 'Invalid token', details: error.message });
    }

    if (!user) {
      console.error('[auth] No user returned from token validation');
      // #region agent log
      try{appendFileSync('/Users/seneca/Desktop/minr.online/.cursor/debug.log',JSON.stringify({location:'auth.ts:45',message:'No user returned',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
      // #endregion
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    console.log('[auth] User authenticated:', user.email, user.id);
    // #region agent log
    try{appendFileSync('/Users/seneca/Desktop/minr.online/.cursor/debug.log',JSON.stringify({location:'auth.ts:52',message:'Auth success',data:{userId:user.id,userEmail:user.email,userIdLength:user.id.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
    // #endregion
    next();
  } catch (error: any) {
    console.error('[auth] Authentication exception:', error);
    // #region agent log
    try{appendFileSync('/Users/seneca/Desktop/minr.online/.cursor/debug.log',JSON.stringify({location:'auth.ts:55',message:'Auth exception',data:{errorMessage:error?.message,errorStack:error?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){}
    // #endregion
    return res.status(401).json({ error: 'Authentication failed', details: error?.message });
  }
}

