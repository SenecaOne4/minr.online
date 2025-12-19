import { Router, Response } from 'express';
import { supabase } from '../supabaseClient';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router: Router = Router();

// POST /api/miner-stats - Report miner statistics (auth optional - validates workerName)
router.post('/', async (req: any, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const { totalHashes, hashesPerSecond, acceptedShares, rejectedShares, workerName } = req.body;

    if (typeof totalHashes !== 'number' || totalHashes < 0) {
      return res.status(400).json({ error: 'Invalid totalHashes' });
    }
    
    // Validate workerName format (minr.emailprefix)
    if (!workerName || typeof workerName !== 'string' || !workerName.startsWith('minr.')) {
      return res.status(400).json({ error: 'Invalid workerName format (must start with minr.)' });
    }

    const finalWorkerName = workerName;
    
    // Try to get userId from auth token if provided
    let userId: string | null = null;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          userId = user.id;
        }
      } catch (e) {
        // Auth failed, will find user by workerName
      }
    }
    
    // If no userId from auth, find it from workerName (email prefix) or existing sessions
    if (!userId) {
      // First try to find from existing sessions
      const { data: existingSession, error: sessionError } = await supabase
        .from('mining_sessions')
        .select('user_id')
        .eq('worker_name', finalWorkerName)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!sessionError && existingSession) {
        userId = existingSession.user_id;
        console.log(`[miner-stats] Found userId ${userId} from existing session for worker ${finalWorkerName}`);
      } else {
        // No existing session - try to find user by email prefix from workerName
        // workerName format: minr.emailprefix -> extract emailprefix
        const emailPrefix = finalWorkerName.replace('minr.', '');
        console.log(`[miner-stats] Looking up user for emailPrefix: ${emailPrefix} from workerName: ${finalWorkerName}`);
        
        // Try multiple lookup strategies:
        // 1. Find by username exact match or prefix match
        let userProfile = null;
        const { data: profilesByUsername, error: profileError1 } = await supabase
          .from('profiles')
          .select('id')
          .or(`username.eq.${emailPrefix},username.ilike.${emailPrefix}%`)
          .limit(1);
        
        if (!profileError1 && profilesByUsername && profilesByUsername.length > 0) {
          userProfile = profilesByUsername[0];
          userId = userProfile.id;
          console.log(`[miner-stats] Found userId ${userId} from profile username match for worker ${finalWorkerName}`);
        } else {
          // 2. Last resort: try to find by listing auth users (if we have admin access)
          try {
            const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
            if (!authError && authUsers && authUsers.users) {
              // Try exact email match first, then prefix match
              let matchingUser = authUsers.users.find(u => 
                u.email?.toLowerCase() === `${emailPrefix}@`.toLowerCase() || 
                u.email?.toLowerCase().startsWith(`${emailPrefix}@`.toLowerCase())
              );
              
              // If no match, try prefix without @
              if (!matchingUser) {
                matchingUser = authUsers.users.find(u => 
                  u.email?.toLowerCase().startsWith(emailPrefix.toLowerCase())
                );
              }
              
              if (matchingUser) {
                userId = matchingUser.id;
                // Create profile if it doesn't exist
                await supabase.from('profiles').upsert({ 
                  id: userId, 
                  username: emailPrefix 
                }, { onConflict: 'id' });
                console.log(`[miner-stats] Found userId ${userId} from auth.users (email: ${matchingUser.email}) and created profile for worker ${finalWorkerName}`);
              } else {
                console.log(`[miner-stats] No matching user found for emailPrefix: ${emailPrefix}`);
              }
            }
          } catch (e) {
            console.error('[miner-stats] Error listing auth users:', e);
          }
        }
        
        // If still no userId, return 401
        if (!userId) {
          return res.status(401).json({ 
            error: 'No user found for workerName. Please start mining from the dashboard first, or provide an authentication token.' 
          });
        }
      }
    }
    
    // Find the most recent active session for this user/worker
    // Schema uses started_at (not created_at or updated_at)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    // Find sessions started within last 10 minutes (still active)
    const { data: existingSessions, error: findError } = await supabase
      .from('mining_sessions')
      .select('id, started_at')
      .eq('user_id', userId)
      .eq('worker_name', finalWorkerName)
      .gte('started_at', tenMinutesAgo)  // Active sessions started recently
      .is('ended_at', null)  // Not ended yet
      .order('started_at', { ascending: false })
      .limit(1);
    
    let activeSession = existingSessions && existingSessions.length > 0 ? existingSessions[0] : null;

    let sessionId: string;

    if (activeSession) {
      // Use existing active session
      sessionId = activeSession.id;
      console.log(`[miner-stats] Updating existing session ${sessionId} for worker ${finalWorkerName}`);
      
      // Calculate duration and average hashrate
      const duration = (Date.now() - new Date(activeSession.started_at).getTime()) / 1000;
      const avgHashrate = duration > 0 ? totalHashes / duration : hashesPerSecond || 0;

      // Update session stats (schema doesn't have updated_at, just update stats)
      const { error: updateError } = await supabase
        .from('mining_sessions')
        .update({
          total_hashes: totalHashes,
          avg_hashrate: avgHashrate,
          accepted_shares: acceptedShares || 0,
          rejected_shares: rejectedShares || 0,
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error('[miner-stats] Error updating session:', updateError);
        return res.status(500).json({ error: 'Failed to update session' });
      }
    } else {
      // No active session found - create new one
      console.log(`[miner-stats] Creating new session for worker ${finalWorkerName} (no active session found)`);
      const { data: newSession, error: createError } = await supabase
        .from('mining_sessions')
        .insert({
          user_id: userId,
          worker_name: finalWorkerName,
          total_hashes: totalHashes,
          avg_hashrate: hashesPerSecond || 0,
          accepted_shares: acceptedShares || 0,
          rejected_shares: rejectedShares || 0,
        })
        .select('id')
        .single();

      if (createError || !newSession) {
        console.error('[miner-stats] Error creating session:', createError);
        return res.status(500).json({ error: 'Failed to create session' });
      }

      sessionId = newSession.id;
    }

    res.json({ success: true, sessionId });
  } catch (error: any) {
    console.error('[miner-stats] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/miner-stats/cleanup - Clean up old/inactive mining sessions (requires auth)
router.delete('/cleanup', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;
    const olderThanMinutesParam = req.query.olderThanMinutes;
    const olderThanMinutes = olderThanMinutesParam ? parseInt(olderThanMinutesParam as string) : 10;

    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();

    // Delete old sessions for this user that started more than X minutes ago
    // Schema uses started_at, not created_at or updated_at
    const { data: sessionsToDelete, error: findError } = await supabase
      .from('mining_sessions')
      .select('id')
      .eq('user_id', userId)
      .lt('started_at', cutoffTime);

    if (findError) {
      console.error('[miner-stats] Error finding sessions to delete:', findError);
      return res.status(500).json({ error: 'Failed to find sessions to delete' });
    }

    if (!sessionsToDelete || sessionsToDelete.length === 0) {
      return res.json({ 
        success: true, 
        message: `No sessions older than ${olderThanMinutes} minutes found`,
        deletedCount: 0
      });
    }

    // Delete the sessions by ID
    const sessionIds = sessionsToDelete.map(s => s.id);
    const { data, error } = await supabase
      .from('mining_sessions')
      .delete()
      .in('id', sessionIds)
      .select();

    if (error) {
      console.error('[miner-stats] Error cleaning up sessions:', error);
      return res.status(500).json({ error: 'Failed to clean up sessions' });
    }

    const deletedCount = Array.isArray(data) ? data.length : 0;

    res.json({ 
      success: true, 
      message: `Cleaned up sessions older than ${olderThanMinutes} minutes`,
      deletedCount
    });
  } catch (error: any) {
    console.error('[miner-stats] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

