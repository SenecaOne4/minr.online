import { Router, Response } from 'express';
import { supabase } from '../supabaseClient';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { generatePaymentAddress } from '../utils/bitcoinAddress';
import { usdToBtc } from '../utils/bitcoinPrice';

const router: Router = Router();
const ENTRY_FEE_USD = parseFloat(process.env.ENTRY_FEE_USD || '1.00');
const PAYMENT_EXPIRY_HOURS = parseInt(process.env.PAYMENT_EXPIRY_HOURS || '24', 10);

// POST /api/payments/request - Create payment request
router.post('/request', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;

    // Check if user already has a pending payment request
    const { data: existingRequest } = await supabase!
      .from('payment_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingRequest) {
      return res.json({
        id: existingRequest.id,
        btc_address: existingRequest.btc_address,
        amount_btc: existingRequest.amount_btc,
        amount_usd: existingRequest.amount_usd,
        expires_at: existingRequest.expires_at,
        status: existingRequest.status,
      });
    }

    // Check if user already paid or is exempt
    const { data: profile } = await supabase!
      .from('profiles')
      .select('has_paid_entry_fee, exempt_from_entry_fee')
      .eq('id', userId)
      .single();

    if (profile?.has_paid_entry_fee || profile?.exempt_from_entry_fee) {
      return res.status(400).json({ error: 'Entry fee already paid or user is exempt' });
    }

    // Calculate BTC amount
    const amountBtc = await usdToBtc(ENTRY_FEE_USD);

    // Generate unique Bitcoin address
    const timestamp = Date.now();
    const btcAddress = generatePaymentAddress(userId, timestamp);

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + PAYMENT_EXPIRY_HOURS);

    // Create payment request
    const { data, error } = await supabase!
      .from('payment_requests')
      .insert({
        user_id: userId,
        btc_address: btcAddress,
        amount_btc: amountBtc.toString(),
        amount_usd: ENTRY_FEE_USD,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      id: data.id,
      btc_address: data.btc_address,
      amount_btc: data.amount_btc,
      amount_usd: data.amount_usd,
      expires_at: data.expires_at,
      status: data.status,
    });
  } catch (error: any) {
    console.error('[payments] Error creating payment request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/payments/status/:requestId - Check payment status
router.get('/status/:requestId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;
    const requestId = req.params.requestId;

    const { data, error } = await supabase!
      .from('payment_requests')
      .select('*')
      .eq('id', requestId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Payment request not found' });
    }

    res.json(data);
  } catch (error: any) {
    console.error('[payments] Error checking status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/payments/history - User payment history
router.get('/history', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;

    const { data, error } = await supabase!
      .from('user_payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error: any) {
    console.error('[payments] Error fetching history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

