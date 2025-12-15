import { Router, Response } from 'express';
import { supabase } from '../supabaseClient';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router: Router = Router();

// GET /api/analytics/user-stats - User mining statistics
router.get('/user-stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;
    const period = req.query.period as string || 'all'; // today, week, month, all

    // Calculate date filter
    let dateFilter: Date | null = null;
    if (period === 'today') {
      dateFilter = new Date();
      dateFilter.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - 7);
    } else if (period === 'month') {
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - 30);
    }

    // Get total hashrate (sum of avg_hashrate from sessions)
    let hashrateQuery = supabase!
      .from('mining_sessions')
      .select('avg_hashrate')
      .eq('user_id', userId);

    if (dateFilter) {
      hashrateQuery = hashrateQuery.gte('started_at', dateFilter.toISOString());
    }

    const { data: sessions } = await hashrateQuery;
    const totalHashrate = sessions?.reduce((sum, s) => sum + parseFloat(s.avg_hashrate?.toString() || '0'), 0) || 0;

    // Get total shares
    let sharesQuery = supabase!
      .from('share_submissions')
      .select('status, submitted_at')
      .eq('user_id', userId);

    if (dateFilter) {
      sharesQuery = sharesQuery.gte('submitted_at', dateFilter.toISOString());
    }

    const { data: shares, error: sharesError } = await sharesQuery;
    
    if (sharesError) {
      console.error('[analytics] Error fetching shares:', sharesError);
    } else {
      console.log(`[analytics] Found ${shares?.length || 0} shares for user ${userId} in period ${period}`);
    }
    
    const acceptedShares = shares?.filter(s => s.status === 'accepted').length || 0;
    const rejectedShares = shares?.filter(s => s.status === 'rejected').length || 0;
    const totalShares = acceptedShares + rejectedShares;
    const acceptanceRate = totalShares > 0 ? (acceptedShares / totalShares) * 100 : 0;

    // Get total earnings from payout_events
    let earningsQuery = supabase!
      .from('payout_events')
      .select('amount_btc')
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (dateFilter) {
      earningsQuery = earningsQuery.gte('created_at', dateFilter.toISOString());
    }

    const { data: payouts } = await earningsQuery;
    const totalEarnings = payouts?.reduce((sum, p) => sum + parseFloat(p.amount_btc?.toString() || '0'), 0) || 0;

    // Get total uptime (sum of session durations)
    const { data: allSessions } = await supabase!
      .from('mining_sessions')
      .select('started_at, ended_at')
      .eq('user_id', userId);

    let totalUptime = 0;
    if (allSessions) {
      for (const session of allSessions) {
        const start = new Date(session.started_at).getTime();
        const end = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
        totalUptime += (end - start) / 1000; // Convert to seconds
      }
    }

    // Get active sessions count
    const { count: activeSessions } = await supabase!
      .from('mining_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('ended_at', null);

    res.json({
      total_hashrate: totalHashrate,
      accepted_shares: acceptedShares,
      rejected_shares: rejectedShares,
      acceptance_rate: acceptanceRate,
      total_earnings: totalEarnings,
      total_uptime: totalUptime,
      active_sessions: activeSessions || 0,
      period,
    });
  } catch (error: any) {
    console.error('[analytics] Error fetching user stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/user-sessions - Mining session history
router.get('/user-sessions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string || '50', 10);
    const offset = parseInt(req.query.offset as string || '0', 10);

    const { data, error } = await supabase!
      .from('mining_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error: any) {
    console.error('[analytics] Error fetching sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/user-shares - Share submission history
router.get('/user-shares', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string || '100', 10);
    const offset = parseInt(req.query.offset as string || '0', 10);

    let query = supabase!
      .from('share_submissions')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error: any) {
    console.error('[analytics] Error fetching shares:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/user-charts - Chart data
router.get('/user-charts', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;
    const type = req.query.type as string || 'hashrate'; // hashrate, shares, earnings
    const period = req.query.period as string || '7'; // days

    const daysAgo = parseInt(period, 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    if (type === 'hashrate') {
      // Get hashrate over time (grouped by day)
      const { data: sessions } = await supabase!
        .from('mining_sessions')
        .select('started_at, avg_hashrate')
        .eq('user_id', userId)
        .gte('started_at', startDate.toISOString())
        .order('started_at', { ascending: true });

      // Group by day
      const dailyData: Record<string, { date: string; hashrate: number }> = {};
      if (sessions) {
        for (const session of sessions) {
          const date = new Date(session.started_at).toISOString().split('T')[0];
          if (!dailyData[date]) {
            dailyData[date] = { date, hashrate: 0 };
          }
          dailyData[date].hashrate += parseFloat(session.avg_hashrate?.toString() || '0');
        }
      }

      res.json(Object.values(dailyData));
    } else if (type === 'shares') {
      // Get shares over time (grouped by day)
      const { data: shares } = await supabase!
        .from('share_submissions')
        .select('submitted_at, status')
        .eq('user_id', userId)
        .gte('submitted_at', startDate.toISOString())
        .order('submitted_at', { ascending: true });

      // Group by day
      const dailyData: Record<string, { date: string; accepted: number; rejected: number }> = {};
      if (shares) {
        for (const share of shares) {
          const date = new Date(share.submitted_at).toISOString().split('T')[0];
          if (!dailyData[date]) {
            dailyData[date] = { date, accepted: 0, rejected: 0 };
          }
          if (share.status === 'accepted') {
            dailyData[date].accepted++;
          } else if (share.status === 'rejected') {
            dailyData[date].rejected++;
          }
        }
      }

      res.json(Object.values(dailyData));
    } else if (type === 'earnings') {
      // Get earnings over time (grouped by day)
      const { data: payouts } = await supabase!
        .from('payout_events')
        .select('created_at, amount_btc')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      // Group by day
      const dailyData: Record<string, { date: string; earnings: number }> = {};
      if (payouts) {
        for (const payout of payouts) {
          const date = new Date(payout.created_at).toISOString().split('T')[0];
          if (!dailyData[date]) {
            dailyData[date] = { date, earnings: 0 };
          }
          dailyData[date].earnings += parseFloat(payout.amount_btc?.toString() || '0');
        }
      }

      res.json(Object.values(dailyData));
    } else {
      res.status(400).json({ error: 'Invalid chart type' });
    }
  } catch (error: any) {
    console.error('[analytics] Error fetching chart data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/pool-stats - Pool aggregate statistics (public)
router.get('/pool-stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const { data, error } = await supabase!
      .from('pool_statistics')
      .select('*')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.json({
        total_hashrate: 0,
        active_miners: 0,
        block_height: null,
        network_difficulty: null,
        pool_difficulty: null,
      });
    }

    res.json({
      total_hashrate: data.total_hashrate,
      active_miners: data.active_miners,
      block_height: data.block_height,
      network_difficulty: data.network_difficulty,
      pool_difficulty: data.pool_difficulty,
      last_updated: data.last_updated,
    });
  } catch (error: any) {
    console.error('[analytics] Error fetching pool stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/export - Export user data as CSV
router.get('/export', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;

    // Get all user sessions
    const { data: sessions } = await supabase!
      .from('mining_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    // Convert to CSV
    const headers = ['Session ID', 'Worker Name', 'Started At', 'Ended At', 'Total Hashes', 'Accepted Shares', 'Rejected Shares', 'Avg Hashrate'];
    const rows = (sessions || []).map(s => [
      s.id,
      s.worker_name,
      s.started_at,
      s.ended_at || '',
      s.total_hashes,
      s.accepted_shares,
      s.rejected_shares,
      s.avg_hashrate,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="mining-data-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error: any) {
    console.error('[analytics] Error exporting data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/my-instances - Get current user's active mining instances
router.get('/my-instances', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;

    // Get all active mining sessions for this user
    const { data: sessions, error } = await supabase!
      .from('mining_sessions')
      .select('id, worker_name, started_at, total_hashes, accepted_shares, rejected_shares, avg_hashrate')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false });

    if (error) {
      console.error('[analytics] Error fetching user instances:', error);
      return res.status(400).json({ error: error.message });
    }

    // Calculate uptime and format data
    const instances = (sessions || []).map(session => {
      const startTime = new Date(session.started_at).getTime();
      const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
      const hours = Math.floor(uptimeSeconds / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      const uptime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      return {
        id: session.id,
        worker_name: session.worker_name,
        started_at: session.started_at,
        uptime,
        uptime_seconds: uptimeSeconds,
        total_hashes: session.total_hashes || 0,
        accepted_shares: session.accepted_shares || 0,
        rejected_shares: session.rejected_shares || 0,
        avg_hashrate: parseFloat(session.avg_hashrate?.toString() || '0'),
      };
    });

    res.json({
      instances,
      count: instances.length,
      total_hashrate: instances.reduce((sum, i) => sum + i.avg_hashrate, 0),
    });
  } catch (error: any) {
    console.error('[analytics] Error fetching user instances:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

