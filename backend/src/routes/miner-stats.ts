import { Router, Response } from 'express';
import { supabase } from '../supabaseClient';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router: Router = Router();

// POST /api/miner-stats - Report miner statistics (requires auth)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;
    const { totalHashes, hashesPerSecond, acceptedShares, rejectedShares, workerName } = req.body;

    if (typeof totalHashes !== 'number' || totalHashes < 0) {
      return res.status(400).json({ error: 'Invalid totalHashes' });
    }

    const finalWorkerName = workerName || `minr.${req.user?.email?.split('@')[0] || 'user'}`;
    
    // Find the most recent session for this user/worker
    // Check both updated_at and created_at to handle cases where updated_at might be null
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    // Try to find any session for this worker (most recent first)
    // Use COALESCE to handle null updated_at by falling back to created_at
    const { data: existingSessions, error: findError } = await supabase
      .from('mining_sessions')
      .select('id, created_at, updated_at')
      .eq('user_id', userId)
      .eq('worker_name', finalWorkerName)
      .order('created_at', { ascending: false })
      .limit(1);
    
    // Check if the most recent session is still "active" (created or updated within last 10 minutes)
    let activeSession = null;
    if (existingSessions && existingSessions.length > 0) {
      const session = existingSessions[0];
      const lastActivity = session.updated_at || session.created_at;
      const lastActivityTime = new Date(lastActivity).getTime();
      const tenMinutesAgoTime = Date.now() - 10 * 60 * 1000;
      
      if (lastActivityTime >= tenMinutesAgoTime) {
        activeSession = session;
      }
    }

    let sessionId: string;

    if (activeSession) {
      // Use existing active session
      sessionId = activeSession.id;
      console.log(`[miner-stats] Updating existing session ${sessionId} for worker ${finalWorkerName}`);
      
      // Calculate duration and average hashrate
      const duration = (Date.now() - new Date(activeSession.created_at).getTime()) / 1000;
      const avgHashrate = duration > 0 ? totalHashes / duration : hashesPerSecond || 0;

      // Update session stats
      const { error: updateError } = await supabase
        .from('mining_sessions')
        .update({
          total_hashes: totalHashes,
          avg_hashrate: avgHashrate,
          accepted_shares: acceptedShares || 0,
          rejected_shares: rejectedShares || 0,
          updated_at: new Date().toISOString(),
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

    // Delete old sessions for this user that haven't been updated recently
    // Handle both updated_at and created_at (in case updated_at is null)
    const { data, error } = await supabase
      .from('mining_sessions')
      .delete()
      .eq('user_id', userId)
      .or(`updated_at.lt.${cutoffTime},and(updated_at.is.null,created_at.lt.${cutoffTime})`)
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

