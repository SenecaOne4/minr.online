import { Router, Response } from 'express';
import { supabase } from '../supabaseClient';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router: Router = Router();

// GET /api/miner-config - Get miner configuration (requires auth)
// This endpoint provides static configuration that miners can fetch
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;

    // Fetch user profile (auto-create if doesn't exist, like cpu-miner-launcher does)
    let { data: profile, error: profileError } = await supabase!
      .from('profiles')
      .select('btc_payout_address, email, has_paid_entry_fee, exempt_from_entry_fee, is_admin')
      .eq('id', userId)
      .single();

    // If profile doesn't exist, create it using upsert (safer than insert)
    if (!profile || profileError) {
      console.log('[miner-config] Profile not found, creating with upsert for user:', userId);
      const { data: newProfile, error: createError } = await supabase!
        .from('profiles')
        .upsert(
          {
            id: userId,
            username: null,
            btc_payout_address: null,
          },
          { onConflict: 'id' }
        )
        .select('btc_payout_address, email, has_paid_entry_fee, exempt_from_entry_fee, is_admin')
        .single();

      if (createError) {
        console.error('[miner-config] Error creating profile:', createError);
        return res.status(500).json({ 
          error: 'Failed to create profile',
          details: createError.message 
        });
      }

      if (!newProfile) {
        console.error('[miner-config] Profile upsert returned no data');
        return res.status(500).json({ error: 'Failed to create profile - no data returned' });
      }

      console.log('[miner-config] Profile created successfully:', newProfile.id || userId);
      profile = newProfile;
    }

    // Check access
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'senecaone4@gmail.com';
    const isAdmin = req.user?.email === ADMIN_EMAIL || profile.is_admin === true;

    if (!profile.has_paid_entry_fee && !profile.exempt_from_entry_fee && !isAdmin) {
      return res.status(403).json({ error: 'Entry fee payment required' });
    }

    if (!profile.btc_payout_address) {
      return res.status(400).json({ error: 'BTC payout address not set' });
    }

    // Get static endpoints from environment
    const stratumEndpoint = process.env.STRATUM_ENDPOINT || 'stratum+tcp://ws.minr.online:3333';
    const stratumHost = stratumEndpoint.includes('://') 
      ? stratumEndpoint.split('://')[1].split(':')[0]
      : stratumEndpoint.split(':')[0];
    const stratumPort = stratumEndpoint.includes(':')
      ? parseInt(stratumEndpoint.split(':').pop() || '3333')
      : 3333;

    // Generate worker name
    const workerName = `minr.${profile.email?.split('@')[0] || 'user'}`;

    // Return configuration
    res.json({
      // Static endpoints (configured on server)
      stratum: {
        host: stratumHost,
        port: stratumPort,
        endpoint: stratumEndpoint,
      },
      // User-specific config
      wallet: profile.btc_payout_address,
      worker: workerName,
      password: 'x', // Standard Stratum password
      // Algorithm
      algorithm: 'sha256d',
      // API endpoints for stats/updates
      api: {
        base: process.env.API_URL || 'https://api.minr.online',
        stats: `${process.env.API_URL || 'https://api.minr.online'}/api/analytics/pool-stats`,
      },
      // Version info
      version: '1.0.0',
      user: profile.email,
      user_email: profile.email, // Alias for compatibility
    });
  } catch (error: any) {
    console.error('[miner-config] Error fetching config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

