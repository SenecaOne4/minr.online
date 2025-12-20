import { supabase } from '../supabaseClient';
import axios from 'axios';

const POLL_INTERVAL = 60 * 1000; // 60 seconds
const BLOCKSTREAM_API_URL = process.env.BLOCKSTREAM_API_URL || 'https://blockstream.info/api';
const BITCOIN_NETWORK = process.env.BITCOIN_NETWORK || 'mainnet';

let statsInterval: NodeJS.Timeout | null = null;

/**
 * Start pool statistics aggregator service
 */
export function startPoolStatsAggregator(): void {
  if (statsInterval) {
    console.log('[poolStats] Service already running');
    return;
  }

  console.log('[poolStats] Starting pool statistics aggregator');
  
  // Run immediately, then every POLL_INTERVAL
  aggregatePoolStats();
  statsInterval = setInterval(aggregatePoolStats, POLL_INTERVAL);
}

/**
 * Stop pool statistics aggregator service
 */
export function stopPoolStatsAggregator(): void {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
    console.log('[poolStats] Service stopped');
  }
}

/**
 * Aggregate pool statistics from active mining sessions
 */
async function aggregatePoolStats(): Promise<void> {
  if (!supabase) {
    console.warn('[poolStats] Supabase not configured');
    return;
  }

  try {
    // Get all active mining sessions (not ended) that have been active in the last 5 minutes
    // This filters out stale sessions that weren't properly closed
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: activeSessions, error: sessionsError } = await supabase
      .from('mining_sessions')
      .select('*')
      .is('ended_at', null)
      .gte('started_at', fiveMinutesAgo);

    if (sessionsError) {
      console.error('[poolStats] Error fetching active sessions:', sessionsError);
      return;
    }

    // Calculate total pool hashrate from truly active sessions
    let totalHashrate = 0;
    const activeMiners = new Set<string>();

    if (activeSessions) {
      for (const session of activeSessions) {
        const sessionHashrate = parseFloat(session.avg_hashrate?.toString() || '0');
        // Only count sessions with reasonable hashrate (> 0 and < 1 TH/s to filter out bad data)
        if (sessionHashrate > 0 && sessionHashrate < 1000000000000) {
          totalHashrate += sessionHashrate;
          activeMiners.add(session.user_id);
        }
      }
    }

    // Fetch current block height and network difficulty
    const { blockHeight, networkDifficulty } = await fetchNetworkStats();

    // Get current pool difficulty from site settings or use default
    const poolDifficulty = await getPoolDifficulty();

    // Insert or update pool statistics
    const { error: statsError } = await supabase
      .from('pool_statistics')
      .insert({
        total_hashrate: totalHashrate,
        active_miners: activeMiners.size,
        block_height: blockHeight,
        network_difficulty: networkDifficulty,
        pool_difficulty: poolDifficulty,
        last_updated: new Date().toISOString(),
      });

    if (statsError) {
      console.error('[poolStats] Error updating statistics:', statsError);
    } else {
      // Format hashrate for logging
      const formattedHashrate = totalHashrate >= 1000000 
        ? `${(totalHashrate / 1000000).toFixed(2)} MH/s`
        : totalHashrate >= 1000
        ? `${(totalHashrate / 1000).toFixed(2)} kH/s`
        : `${totalHashrate.toFixed(2)} H/s`;
      
      console.log(
        `[poolStats] Updated: ${formattedHashrate}, ${activeMiners.size} miners, block ${blockHeight}`
      );
    }
  } catch (error: any) {
    console.error('[poolStats] Error in aggregation:', error.message);
  }
}

/**
 * Fetch current block height and network difficulty
 */
async function fetchNetworkStats(): Promise<{ blockHeight: number | null; networkDifficulty: number | null }> {
  try {
    const networkPrefix = BITCOIN_NETWORK === 'testnet' ? 'testnet/' : '';
    const url = `${BLOCKSTREAM_API_URL}/${networkPrefix}blocks/tip/height`;

    const response = await axios.get(url, { timeout: 5000 });
    const blockHeight = parseInt(response.data, 10);

    // Fetch difficulty from block info
    let networkDifficulty: number | null = null;
    try {
      const blockUrl = `${BLOCKSTREAM_API_URL}/${networkPrefix}block-height/${blockHeight}`;
      const blockHashResponse = await axios.get(blockUrl, { timeout: 5000 });
      const blockHash = Array.isArray(blockHashResponse.data) 
        ? blockHashResponse.data[0] 
        : blockHashResponse.data;

      if (blockHash) {
        const blockInfoUrl = `${BLOCKSTREAM_API_URL}/${networkPrefix}block/${blockHash}`;
        const blockInfoResponse = await axios.get(blockInfoUrl, { timeout: 5000 });
        networkDifficulty = blockInfoResponse.data.difficulty || null;
      }
    } catch (error) {
      // Difficulty fetch is optional
      console.warn('[poolStats] Could not fetch network difficulty');
    }

    return { blockHeight, networkDifficulty };
  } catch (error: any) {
    console.error('[poolStats] Error fetching network stats:', error.message);
    return { blockHeight: null, networkDifficulty: null };
  }
}

/**
 * Get current pool difficulty from site settings
 */
async function getPoolDifficulty(): Promise<number | null> {
  if (!supabase) return null;

  try {
    // Get the most recent pool statistics to get current difficulty
    const { data, error } = await supabase
      .from('pool_statistics')
      .select('pool_difficulty')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data.pool_difficulty ? parseFloat(data.pool_difficulty.toString()) : null;
  } catch (error) {
    return null;
  }
}

