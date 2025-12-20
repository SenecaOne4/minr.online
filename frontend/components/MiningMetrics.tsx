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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
      {/* Pool Metrics */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-pink-500/20 border border-white/20 rounded-2xl p-6 shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 hover:scale-[1.02] relative overflow-hidden">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10 animate-gradient opacity-50"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <h3 className="text-xl font-bold text-white">Pool Statistics</h3>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin-slow"></div>
              <span className="text-sm">Loading...</span>
            </div>
          ) : poolStats ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-3 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all">
                <div className="text-xs text-gray-400 mb-1">Total Pool Hashrate</div>
                <div className="text-xl font-bold text-white bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  {formatHashrate(poolStats.total_hashrate)}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all">
                <div className="text-xs text-gray-400 mb-1">Active Miners</div>
                <div className="text-xl font-bold text-white">{poolStats.active_miners}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all">
                <div className="text-xs text-gray-400 mb-1">Block Height</div>
                <div className="text-xl font-bold text-white">{poolStats.block_height || 'N/A'}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all">
                <div className="text-xs text-gray-400 mb-1">Network Difficulty</div>
                <div className="text-xl font-bold text-white">{formatDifficulty(poolStats.network_difficulty)}</div>
              </div>
              {poolStats.pool_difficulty && (
                <div className="bg-white/5 rounded-lg p-3 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all col-span-2">
                  <div className="text-xs text-gray-400 mb-1">Pool Difficulty</div>
                  <div className="text-xl font-bold text-white">{formatDifficulty(poolStats.pool_difficulty)}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-400 text-sm">No pool statistics available</div>
          )}
        </div>
      </div>

      {/* User Performance Metrics */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-green-500/20 via-emerald-500/10 to-teal-500/20 border border-white/20 rounded-2xl p-6 shadow-2xl hover:shadow-green-500/20 transition-all duration-300 hover:scale-[1.02] relative overflow-hidden">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-600/10 via-emerald-600/10 to-teal-600/10 animate-gradient opacity-50"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              connectionStatus === 'connected' ? 'bg-green-400' :
              connectionStatus === 'connecting' ? 'bg-yellow-400' :
              'bg-red-400'
            }`}></div>
            <h3 className="text-xl font-bold text-white">Your Performance</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-3 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all">
              <div className="text-xs text-gray-400 mb-1">Current Hashrate</div>
              <div className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                {formatHashrate(currentHashrate)}
              </div>
              {currentHashrate > 0 && (
                <div className="mt-1 h-1 bg-green-500/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-400 to-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (currentHashrate / 10000) * 100)}%` }}
                  ></div>
                </div>
              )}
            </div>
            <div className="bg-white/5 rounded-lg p-3 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all">
              <div className="text-xs text-gray-400 mb-1">Shares Submitted</div>
              <div className="text-xl font-bold text-white">{totalShares}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all">
              <div className="text-xs text-gray-400 mb-1">Accepted</div>
              <div className="text-xl font-bold text-green-400 flex items-center gap-2">
                <span>{sharesAccepted}</span>
                {sharesAccepted > 0 && <span className="text-sm animate-pulse">✓</span>}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all">
              <div className="text-xs text-gray-400 mb-1">Rejected</div>
              <div className="text-xl font-bold text-red-400">{sharesRejected}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all">
              <div className="text-xs text-gray-400 mb-1">Acceptance Rate</div>
              <div className="text-xl font-bold text-white">{acceptanceRate.toFixed(1)}%</div>
              <div className="mt-1 h-1 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 to-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: `${acceptanceRate}%` }}
                ></div>
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all">
              <div className="text-xs text-gray-400 mb-1">Connection</div>
              <div className={`text-xl font-bold flex items-center gap-2 ${
                connectionStatus === 'connected' ? 'text-green-400' :
                connectionStatus === 'connecting' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                <span>{connectionStatus.toUpperCase()}</span>
                {connectionStatus === 'connected' && (
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

