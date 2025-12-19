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
    
    // Find the most recent active session for this user/worker (updated within last 5 minutes)
    // This prevents creating duplicate sessions if stats are reported frequently
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: existingSessions, error: findError } = await supabase
      .from('mining_sessions')
      .select('id, created_at, updated_at')
      .eq('user_id', userId)
      .eq('worker_name', finalWorkerName)
      .gte('updated_at', fiveMinutesAgo)  // Only consider recently updated sessions
      .order('updated_at', { ascending: false })
      .limit(1);

    let sessionId: string;

    if (existingSessions && existingSessions.length > 0) {
      // Use existing active session
      const existingSession = existingSessions[0];
      sessionId = existingSession.id;
      
      // Calculate duration and average hashrate
      const duration = (Date.now() - new Date(existingSession.created_at).getTime()) / 1000;
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
    const { olderThanMinutes = 10 } = req.query; // Default: delete sessions older than 10 minutes

    const cutoffTime = new Date(Date.now() - parseInt(olderThanMinutes as string) * 60 * 1000).toISOString();

    // Delete old sessions for this user that haven't been updated recently
    const { data, error } = await supabase
      .from('mining_sessions')
      .delete()
      .eq('user_id', userId)
      .lt('updated_at', cutoffTime);

    if (error) {
      console.error('[miner-stats] Error cleaning up sessions:', error);
      return res.status(500).json({ error: 'Failed to clean up sessions' });
    }

    res.json({ 
      success: true, 
      message: `Cleaned up sessions older than ${olderThanMinutes} minutes`,
      deletedCount: data?.length || 0
    });
  } catch (error: any) {
    console.error('[miner-stats] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

