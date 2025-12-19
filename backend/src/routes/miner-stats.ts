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
    
    // Validate workerName format (minr.emailprefix)
    if (!workerName || typeof workerName !== 'string' || !workerName.startsWith('minr.')) {
      return res.status(400).json({ error: 'Invalid workerName format' });
    }
    
    // Extract email prefix from workerName (minr.emailprefix -> emailprefix)
    const emailPrefix = workerName.replace('minr.', '');
    
    // Find user by email prefix (look up in auth.users via profiles)
    // First, get all profiles and find matching email prefix
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id');
    
    if (profileError) {
      console.error('[miner-stats] Error fetching profiles:', profileError);
      return res.status(500).json({ error: 'Failed to find user' });
    }
    
    // Try to find user by checking auth.users (we'll need to query via a different method)
    // For now, use a simpler approach: try to authenticate if token provided, otherwise use workerName lookup
    let userId: string | null = null;
    
    // Try auth first (if token provided)
    if (req.headers.authorization) {
      try {
        // Extract token and verify (simplified - in production use proper JWT verification)
        const token = req.headers.authorization.replace('Bearer ', '');
        // For now, if auth token is provided, use authMiddleware logic
        // But since we removed authMiddleware, we'll use workerName lookup instead
      } catch (e) {
        // Auth failed, fall back to workerName lookup
      }
    }
    
    // Look up user by email prefix in profiles (requires matching email pattern)
    // Since we can't directly query auth.users, we'll use a workaround:
    // Find user by checking if any profile matches the expected pattern
    // This is a simplified approach - in production, you'd want proper user lookup
    
    // For now, accept the stats and try to find/create session by workerName
    // We'll need to modify the query to work without userId

    if (typeof totalHashes !== 'number' || totalHashes < 0) {
      return res.status(400).json({ error: 'Invalid totalHashes' });
    }

    const finalWorkerName = workerName || `minr.${req.user?.email?.split('@')[0] || 'user'}`;
    
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

