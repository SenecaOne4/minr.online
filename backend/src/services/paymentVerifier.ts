import { supabase } from '../supabaseClient';
import { checkAddressTransactions, calculateReceivedAmount, getTransaction } from '../utils/bitcoinApi';
import { usdToBtc } from '../utils/bitcoinPrice';

const POLL_INTERVAL = 30 * 1000; // 30 seconds
const PAYMENT_CONFIRMATIONS = parseInt(process.env.PAYMENT_CONFIRMATIONS || '1', 10);

let verificationInterval: NodeJS.Timeout | null = null;

/**
 * Start payment verification service
 */
export function startPaymentVerifier(): void {
  if (verificationInterval) {
    console.log('[paymentVerifier] Service already running');
    return;
  }

  console.log('[paymentVerifier] Starting payment verification service');
  
  // Run immediately, then every POLL_INTERVAL
  verifyPendingPayments();
  verificationInterval = setInterval(verifyPendingPayments, POLL_INTERVAL);
}

/**
 * Stop payment verification service
 */
export function stopPaymentVerifier(): void {
  if (verificationInterval) {
    clearInterval(verificationInterval);
    verificationInterval = null;
    console.log('[paymentVerifier] Service stopped');
  }
}

/**
 * Verify pending payment requests
 */
async function verifyPendingPayments(): Promise<void> {
  if (!supabase) {
    console.warn('[paymentVerifier] Supabase not configured');
    return;
  }

  try {
    // Get all pending payment requests that haven't expired
    const { data: pendingRequests, error } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    if (error) {
      console.error('[paymentVerifier] Error fetching pending requests:', error);
      return;
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      return; // No pending requests
    }

    console.log(`[paymentVerifier] Checking ${pendingRequests.length} pending payment(s)`);

    for (const request of pendingRequests) {
      await verifyPaymentRequest(request);
    }

    // Also expire old payment requests
    await expireOldPaymentRequests();
  } catch (error: any) {
    console.error('[paymentVerifier] Error in verification loop:', error.message);
  }
}

/**
 * Verify a single payment request
 */
async function verifyPaymentRequest(request: any): Promise<void> {
  if (!supabase) return;

  try {
    // Check blockchain for transactions to this address
    const transactions = await checkAddressTransactions(request.btc_address);

    if (transactions.length === 0) {
      return; // No transactions yet
    }

    // Calculate total received amount
    const receivedAmount = calculateReceivedAmount(transactions, request.btc_address);

    // Check if amount matches (with small tolerance for fees)
    const tolerance = 0.00001; // 0.00001 BTC tolerance
    const requiredAmount = parseFloat(request.amount_btc);
    
    if (receivedAmount >= requiredAmount - tolerance) {
      // Find the transaction that matches
      const matchingTx = transactions.find(tx => {
        const txAmount = calculateReceivedAmount([tx], request.btc_address);
        return txAmount >= requiredAmount - tolerance;
      });

      if (matchingTx) {
        // Check confirmations
        const confirmations = matchingTx.status.confirmed ? (matchingTx.status.block_height ? 1 : 0) : 0;
        
        if (confirmations >= PAYMENT_CONFIRMATIONS) {
          await markPaymentAsPaid(request, matchingTx.txid, receivedAmount);
        } else {
          // Payment found but not confirmed enough
          console.log(`[paymentVerifier] Payment found for ${request.id} but only ${confirmations} confirmations`);
        }
      }
    }
  } catch (error: any) {
    console.error(`[paymentVerifier] Error verifying request ${request.id}:`, error.message);
  }
}

/**
 * Mark payment request as paid and grant user access
 */
async function markPaymentAsPaid(
  request: any,
  txHash: string,
  receivedAmount: number
): Promise<void> {
  if (!supabase) return;

  try {
    // Update payment request
    const { error: updateError } = await supabase
      .from('payment_requests')
      .update({
        status: 'paid',
        tx_hash: txHash,
        paid_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (updateError) {
      throw updateError;
    }

    // Create user_payment record
    const { error: paymentError } = await supabase
      .from('user_payments')
      .insert({
        user_id: request.user_id,
        payment_request_id: request.id,
        amount_btc: receivedAmount.toString(),
        amount_usd: request.amount_usd.toString(),
        tx_hash: txHash,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      });

    if (paymentError) {
      console.error('[paymentVerifier] Error creating payment record:', paymentError);
    }

    // Update user profile to grant access
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        has_paid_entry_fee: true,
        entry_fee_paid_at: new Date().toISOString(),
      })
      .eq('id', request.user_id);

    if (profileError) {
      console.error('[paymentVerifier] Error updating profile:', profileError);
    }

    console.log(`[paymentVerifier] Payment confirmed for user ${request.user_id}, tx: ${txHash}`);
  } catch (error: any) {
    console.error('[paymentVerifier] Error marking payment as paid:', error.message);
  }
}

/**
 * Expire old payment requests
 */
async function expireOldPaymentRequests(): Promise<void> {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('payment_requests')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    if (error) {
      console.error('[paymentVerifier] Error expiring requests:', error);
    }
  } catch (error: any) {
    console.error('[paymentVerifier] Error in expire function:', error.message);
  }
}

