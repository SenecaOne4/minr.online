'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  username: string | null;
  btc_payout_address: string | null;
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

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      // Get auth token (only if Supabase is configured)
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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
      }

      // Fetch membership
      const membershipRes = await fetch(`${apiBaseUrl}/api/membership`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (membershipRes.ok) {
        const membershipData = await membershipRes.json();
        setMembership(membershipData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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

      if (res.ok) {
        const updatedProfile = await res.json();
        setProfile(updatedProfile);
        setEditing(false);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const handleStartMining = () => {
    // Placeholder for future mining functionality
    alert('Mining functionality coming soon!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Minr.online</h1>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-600 mr-4">{user.email}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Profile</h2>
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    BTC Payout Address
                  </label>
                  <input
                    type="text"
                    value={btcAddress}
                    onChange={(e) => setBtcAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="bc1..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setUsername(profile?.username || '');
                      setBtcAddress(profile?.btc_payout_address || '');
                    }}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Username</p>
                  <p className="text-lg font-semibold">
                    {profile?.username || 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">BTC Payout Address</p>
                  <p className="text-lg font-semibold">
                    {profile?.btc_payout_address || 'Not set'}
                  </p>
                </div>
                <button
                  onClick={() => setEditing(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Edit Profile
                </button>
              </div>
            )}
          </div>

          {/* Membership Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Membership</h2>
            {membership ? (
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className={`text-lg font-semibold ${
                    membership.status === 'active' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {membership.status.toUpperCase()}
                  </p>
                </div>
                {membership.expires_at && (
                  <div>
                    <p className="text-sm text-gray-600">Expires At</p>
                    <p className="text-lg">
                      {new Date(membership.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-600">No membership found</p>
            )}
          </div>
        </div>

        {/* Mining Section */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-4">Mining</h2>
          <button
            onClick={handleStartMining}
            className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 text-lg font-semibold"
          >
            Start Mining
          </button>
          <p className="text-sm text-gray-600 mt-2">
            Connect your browser miner or hardware miner to start mining.
          </p>
        </div>
      </main>
    </div>
  );
}

