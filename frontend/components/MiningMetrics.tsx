'use client';

import { useState, useEffect } from 'react';

interface PoolStats {
  total_hashrate: number;
  active_miners: number;
  block_height: number | null;
  network_difficulty: number | null;
  pool_difficulty: number | null;
  last_updated: string;
}

interface UserMetrics {
  currentHashrate: number;
  sharesSubmitted: number;
  sharesAccepted: number;
  sharesRejected: number;
  acceptanceRate: number;
  connectionLatency: number | null;
}

interface MiningMetricsProps {
  currentHashrate?: number;
  sharesAccepted?: number;
  sharesRejected?: number;
  connectionStatus?: 'connected' | 'disconnected' | 'connecting' | 'error';
}

export default function MiningMetrics({
  currentHashrate = 0,
  sharesAccepted = 0,
  sharesRejected = 0,
  connectionStatus = 'disconnected',
}: MiningMetricsProps) {
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPoolStats();
    const interval = setInterval(loadPoolStats, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadPoolStats = async () => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/analytics/pool-stats`);

      if (response.ok) {
        const data = await response.json();
        setPoolStats(data);
      }
    } catch (error) {
      console.error('Error loading pool stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatHashrate = (h: number): string => {
    if (h >= 1000000) return `${(h / 1000000).toFixed(2)} MH/s`;
    if (h >= 1000) return `${(h / 1000).toFixed(2)} kH/s`;
    return `${h.toFixed(2)} H/s`;
  };

  const formatDifficulty = (d: number | null): string => {
    if (!d) return 'N/A';
    if (d >= 1000000) return `${(d / 1000000).toFixed(2)}M`;
    if (d >= 1000) return `${(d / 1000).toFixed(2)}K`;
    return d.toFixed(2);
  };

  const totalShares = sharesAccepted + sharesRejected;
  const acceptanceRate = totalShares > 0 ? (sharesAccepted / totalShares) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Pool Metrics */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-xl p-4 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-3">Pool Statistics</h3>
        {loading ? (
          <div className="text-gray-400 text-sm">Loading...</div>
        ) : poolStats ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400">Total Pool Hashrate</div>
              <div className="text-lg font-bold text-white">{formatHashrate(poolStats.total_hashrate)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Active Miners</div>
              <div className="text-lg font-bold text-white">{poolStats.active_miners}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Block Height</div>
              <div className="text-lg font-bold text-white">{poolStats.block_height || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Network Difficulty</div>
              <div className="text-lg font-bold text-white">{formatDifficulty(poolStats.network_difficulty)}</div>
            </div>
            {poolStats.pool_difficulty && (
              <div>
                <div className="text-xs text-gray-400">Pool Difficulty</div>
                <div className="text-lg font-bold text-white">{formatDifficulty(poolStats.pool_difficulty)}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-400 text-sm">No pool statistics available</div>
        )}
      </div>

      {/* User Performance Metrics */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-xl p-4 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-3">Your Performance</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-400">Current Hashrate</div>
            <div className="text-lg font-bold text-white">{formatHashrate(currentHashrate)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Shares Submitted</div>
            <div className="text-lg font-bold text-white">{totalShares}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Accepted</div>
            <div className="text-lg font-bold text-green-400">{sharesAccepted}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Rejected</div>
            <div className="text-lg font-bold text-red-400">{sharesRejected}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Acceptance Rate</div>
            <div className="text-lg font-bold text-white">{acceptanceRate.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Connection</div>
            <div className={`text-lg font-bold ${
              connectionStatus === 'connected' ? 'text-green-400' :
              connectionStatus === 'connecting' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {connectionStatus.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

