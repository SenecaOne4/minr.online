import { Router, Response } from 'express';
import { supabase } from '../supabaseClient';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { generateMinerScript } from '../utils/minerScriptGenerator';

const router: Router = Router();
const STRATUM_ENDPOINT = process.env.STRATUM_UPSTREAM || 'solo.ckpool.org:3333';
const API_URL = process.env.API_URL || 'https://api.minr.online';

// GET /api/miner-download - Generate configured miner script (requires payment)
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;

    // Check if user has paid entry fee or is exempt
    const { data: profile } = await supabase!
      .from('profiles')
      .select('has_paid_entry_fee, exempt_from_entry_fee, btc_payout_address, email')
      .eq('id', userId)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (!profile.has_paid_entry_fee && !profile.exempt_from_entry_fee) {
      return res.status(403).json({ error: 'Entry fee payment required to download miner' });
    }

    if (!profile.btc_payout_address) {
      return res.status(400).json({ error: 'BTC payout address not set in profile' });
    }

    // Generate miner script with user's credentials
    const script = generateMinerScript({
      userEmail: profile.email || '',
      btcWallet: profile.btc_payout_address,
      stratumEndpoint: STRATUM_ENDPOINT,
      apiUrl: API_URL,
      workerName: `minr.${profile.email?.split('@')[0] || 'user'}`,
    });

    // Send as downloadable file
    res.setHeader('Content-Type', 'text/x-python');
    res.setHeader('Content-Disposition', `attachment; filename="minr-miner-${Date.now()}.py"`);
    res.send(script);
  } catch (error: any) {
    console.error('[miner-download] Error generating script:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

