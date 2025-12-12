'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface UserStats {
  total_hashrate: number;
  accepted_shares: number;
  rejected_shares: number;
  acceptance_rate: number;
  total_earnings: number;
  total_uptime: number;
  active_sessions: number;
  period: string;
}

interface ChartDataPoint {
  date: string;
  hashrate?: number;
  accepted?: number;
  rejected?: number;
  earnings?: number;
}

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [period, setPeriod] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [period]);

  useEffect(() => {
    if (stats) {
      loadChartData();
    }
  }, [period, stats]);

  const loadStats = async () => {
    try {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/analytics/user-stats?period=${period}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChartData = async () => {
    try {
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const days = period === 'all' ? '30' : period === 'week' ? '7' : '1';
      
      const response = await fetch(`${apiBaseUrl}/api/analytics/user-charts?type=hashrate&period=${days}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setChartData(data);
      }
    } catch (error) {
      console.error('Error loading chart data:', error);
    }
  };

  const formatHashrate = (h: number): string => {
    if (h >= 1000000) return `${(h / 1000000).toFixed(2)} MH/s`;
    if (h >= 1000) return `${(h / 1000).toFixed(2)} kH/s`;
    return `${h.toFixed(2)} H/s`;
  };

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
        <div className="text-center text-white">Loading analytics...</div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex gap-2">
        {['today', 'week', 'month', 'all'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-xl transition-all duration-200 ${
              period === p
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-xl p-4 shadow-xl">
          <div className="text-sm text-gray-400 mb-1">Total Hashrate</div>
          <div className="text-2xl font-bold text-white">{formatHashrate(stats.total_hashrate)}</div>
        </div>
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-xl p-4 shadow-xl">
          <div className="text-sm text-gray-400 mb-1">Accepted Shares</div>
          <div className="text-2xl font-bold text-green-400">{stats.accepted_shares.toLocaleString()}</div>
        </div>
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-xl p-4 shadow-xl">
          <div className="text-sm text-gray-400 mb-1">Acceptance Rate</div>
          <div className="text-2xl font-bold text-white">{stats.acceptance_rate.toFixed(1)}%</div>
        </div>
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-xl p-4 shadow-xl">
          <div className="text-sm text-gray-400 mb-1">Total Earnings</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.total_earnings.toFixed(8)} BTC</div>
        </div>
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-xl p-4 shadow-xl">
          <div className="text-sm text-gray-400 mb-1">Total Uptime</div>
          <div className="text-2xl font-bold text-white">{formatUptime(stats.total_uptime)}</div>
        </div>
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-xl p-4 shadow-xl">
          <div className="text-sm text-gray-400 mb-1">Rejected Shares</div>
          <div className="text-2xl font-bold text-red-400">{stats.rejected_shares.toLocaleString()}</div>
        </div>
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-xl p-4 shadow-xl">
          <div className="text-sm text-gray-400 mb-1">Active Sessions</div>
          <div className="text-2xl font-bold text-white">{stats.active_sessions}</div>
        </div>
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-xl p-6 shadow-2xl">
          <h3 className="text-xl font-bold text-white mb-4">Hashrate Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis dataKey="date" stroke="#ffffff80" />
              <YAxis stroke="#ffffff80" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #ffffff20' }} />
              <Legend />
              <Line type="monotone" dataKey="hashrate" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

