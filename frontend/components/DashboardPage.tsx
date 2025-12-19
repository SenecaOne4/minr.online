'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PaymentGate from '@/components/PaymentGate';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import MembershipTierCard from '@/components/MembershipTierCard';

interface Profile {
  id: string;
  username: string | null;
  btc_payout_address: string | null;
  has_paid_entry_fee?: boolean;
  exempt_from_entry_fee?: boolean;
  is_admin?: boolean;
}

interface Membership {
  id: string;
  status: string;
  expires_at: string | null;
}

export default function DashboardPage({ user }: { user: any }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [btcAddress, setBtcAddress] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [hasPaidEntryFee, setHasPaidEntryFee] = useState(false);
  const [miningInstances, setMiningInstances] = useState<any>(null);
  
  // Check if user is admin (compare email to admin email)
  const isAdmin = user?.email === 'senecaone4@gmail.com' || profile?.is_admin === true;

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    // Load mining instances and set up polling
    if (hasPaidEntryFee || profile?.exempt_from_entry_fee || isAdmin) {
      loadMiningInstances();
      const interval = setInterval(loadMiningInstances, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [hasPaidEntryFee, profile, isAdmin]);

  const loadData = async () => {
    try {
      // Get auth token (only if Supabase is configured)
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Use relative URL for API calls (works with NGINX proxy)
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';

      // Fetch profile
      const profileRes = await fetch(`${apiBaseUrl}/api/profile`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
        setUsername(profileData.username || '');
        setBtcAddress(profileData.btc_payout_address || '');
        // Admins are automatically exempt from entry fee
        const isAdminUser = user?.email === 'senecaone4@gmail.com' || profileData.is_admin === true;
        setHasPaidEntryFee(profileData.has_paid_entry_fee || profileData.exempt_from_entry_fee || isAdminUser);
      }

      // Fetch membership (returns null if not found, not 404)
      const membershipRes = await fetch(`${apiBaseUrl}/api/membership`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (membershipRes.ok) {
        const membershipData = await membershipRes.json();
        // Handle null response (no membership found)
        if (membershipData) {
          setMembership(membershipData);
        } else {
          setMembership(null);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMiningInstances = async () => {
    try {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/analytics/my-instances`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMiningInstances(data);
      }
    } catch (error) {
      console.error('Error loading mining instances:', error);
    }
  };

  const formatHashrate = (h: number): string => {
    if (h >= 1000000) return `${(h / 1000000).toFixed(2)} MH/s`;
    if (h >= 1000) return `${(h / 1000).toFixed(2)} kH/s`;
    return `${h.toFixed(2)} H/s`;
  };

  const handleSaveProfile = async () => {
    try {
      if (!supabase) {
        setSaveMessage('Error: Supabase not configured');
        setTimeout(() => setSaveMessage(null), 3000);
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSaveMessage('Error: Not authenticated. Please log in again.');
        setTimeout(() => setSaveMessage(null), 3000);
        return;
      }

      // Use relative URL for API calls (works with NGINX proxy)
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';

      setSaveMessage('Saving...');
      
      const res = await fetch(`${apiBaseUrl}/api/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          username,
          btc_payout_address: btcAddress,
        }),
      });

      const responseData = await res.json().catch(() => ({}));

      if (res.ok) {
        setProfile(responseData);
        setEditing(false);
        setSaveMessage('Profile saved successfully!');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        const errorMsg = responseData.error || `HTTP ${res.status}: ${res.statusText}`;
        console.error('Profile save error:', errorMsg, responseData);
        setSaveMessage(`Error: ${errorMsg}`);
        setTimeout(() => setSaveMessage(null), 5000);
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setSaveMessage(`Error: ${error?.message || 'Failed to save profile'}`);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Navbar userEmail={user.email} isAdmin={isAdmin} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Join the Minr.online Lottery Pool • Manage your profile and start mining</p>
        </div>

        {/* Payment Gate - Don't show for admins */}
        {!hasPaidEntryFee && !profile?.exempt_from_entry_fee && !isAdmin && (
          <div className="mb-6">
            <PaymentGate />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Profile Card */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-purple-500/10 to-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-white">Profile</h2>
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500/50 backdrop-blur-sm transition-all duration-200"
                    placeholder="Choose a username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    BTC Payout Address
                  </label>
                  <input
                    type="text"
                    value={btcAddress}
                    onChange={(e) => setBtcAddress(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 backdrop-blur-sm font-mono text-sm"
                    placeholder="bc1..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setUsername(profile?.username || '');
                      setBtcAddress(profile?.btc_payout_address || '');
                    }}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl transition-all duration-200 border border-white/20 shadow-md hover:shadow-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400">Username</p>
                  <p className="text-lg font-semibold text-white">
                    {profile?.username || <span className="text-gray-500 italic">Not set</span>}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">BTC Payout Address</p>
                  <p className="text-lg font-semibold text-white font-mono break-all">
                    {profile?.btc_payout_address || <span className="text-gray-500 italic">Not set</span>}
                  </p>
                </div>
                <button
                  onClick={() => setEditing(true)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                >
                  Edit Profile
                </button>
              </div>
            )}
            {saveMessage && (
              <div className={`mt-4 p-3 rounded-lg backdrop-blur-sm ${
                saveMessage.includes('Error')
                  ? 'bg-red-900/30 border border-red-500/50 text-red-200'
                  : 'bg-green-900/30 border border-green-500/50 text-green-200'
              }`}>
                <p className="text-sm">{saveMessage}</p>
              </div>
            )}
          </div>

          {/* Membership Card */}
          <MembershipTierCard 
            membership={membership}
            isExempt={profile?.exempt_from_entry_fee || false}
            isAdmin={profile?.is_admin || false}
          />
        </div>

        {/* Active Mining Instances Section */}
        {(hasPaidEntryFee || profile?.exempt_from_entry_fee || isAdmin) && (
          <div className="mb-6">
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-blue-500/10 to-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Active Mining Instances</h2>
                <button
                  onClick={async () => {
                    if (!supabase) return;
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) return;
                    
                    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
                    const response = await fetch(`${apiBaseUrl}/api/miner-stats/cleanup?olderThanMinutes=5`, {
                      method: 'DELETE',
                      headers: {
                        Authorization: `Bearer ${session.access_token}`,
                      },
                    });
                    
                    if (response.ok) {
                      const result = await response.json();
                      alert(`Cleaned up ${result.deletedCount || 0} old sessions`);
                      loadMiningInstances(); // Refresh the list
                    } else {
                      alert('Failed to clean up sessions');
                    }
                  }}
                  className="px-4 py-2 bg-red-600/80 hover:bg-red-700 text-white rounded-lg text-sm transition-all"
                >
                  Clean Up Old Sessions
                </button>
              </div>
              {miningInstances && miningInstances.count > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-400">Total Active Miners</p>
                      <p className="text-3xl font-bold text-white">{miningInstances.count}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Combined Hashrate</p>
                      <p className="text-2xl font-bold text-green-400">{formatHashrate(miningInstances.total_hashrate)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {miningInstances.instances.map((instance: any) => (
                      <div key={instance.id} className="bg-black/30 border border-white/20 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="font-semibold text-white">{instance.worker_name}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-gray-400">Uptime</p>
                            <p className="text-white">{instance.uptime}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Hashrate</p>
                            <p className="text-green-400">{formatHashrate(instance.avg_hashrate)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Accepted</p>
                            <p className="text-green-400">{instance.accepted_shares}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Rejected</p>
                            <p className="text-red-400">{instance.rejected_shares}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">No active mining instances</p>
                  <p className="text-sm text-gray-500 mt-2">Start mining to see your instances here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Section */}
        {(hasPaidEntryFee || profile?.exempt_from_entry_fee || isAdmin) && (
          <div className="mb-6">
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-green-500/10 to-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-2xl font-bold mb-4 text-white">Mining Analytics</h2>
              <AnalyticsDashboard />
            </div>
          </div>
        )}

        {/* Mining Section */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-purple-500/10 to-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-2xl font-bold mb-4 text-white">Start Mining</h2>
          <p className="text-gray-300 mb-6">
            Join the lottery pool! If someone solves a block, we split the BTC payout. Download the CPU miner launcher to get started.
          </p>
          {(hasPaidEntryFee || profile?.exempt_from_entry_fee || isAdmin) && (
            <div>
              <Link
                href="/miners"
                className="inline-block bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 hover:from-purple-700 hover:via-pink-700 hover:to-purple-800 text-white px-6 py-2 rounded-xl text-base font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Download CPU Miner Launcher →
              </Link>
              {hasPaidEntryFee || profile?.exempt_from_entry_fee || isAdmin ? (
                <p className="text-sm text-gray-400 mt-4">
                  Make sure your profile is complete with a BTC payout address before mining.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

