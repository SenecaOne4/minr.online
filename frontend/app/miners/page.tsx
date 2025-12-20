'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface Profile {
  btc_payout_address: string | null;
  has_paid_entry_fee?: boolean;
  exempt_from_entry_fee?: boolean;
  is_admin?: boolean;
}

export default function MinersPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          loadProfile(session.access_token);
        } else {
          setLoading(false);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          loadProfile(session.access_token);
        } else {
          setLoading(false);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const loadProfile = async (token: string) => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const STRATUM_ENDPOINT = 'stratum+tcp://ws.minr.online:3333';
  const BTC_ADDRESS = profile?.btc_payout_address || 'YOUR_BITCOIN_ADDRESS';
  const hasAccess = profile?.has_paid_entry_fee || profile?.exempt_from_entry_fee || profile?.is_admin;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="text-xl text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <Navbar userEmail={user?.email} isAdmin={profile?.is_admin} />
      
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Download Miner
          </h1>
          <p className="text-xl text-gray-300">
            Choose your platform to start mining
          </p>
        </div>

        {!hasAccess && (
          <div className="backdrop-blur-xl bg-red-900/30 border-2 border-red-500/50 rounded-2xl p-6 mb-8 shadow-2xl">
            <h2 className="text-xl font-bold text-red-200 mb-2">Entry Fee Required</h2>
            <p className="text-gray-300 mb-4">
              You must pay the $1 USD entry fee to download miners and connect external devices.
            </p>
            <Link
              href="/"
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Go to Dashboard
            </Link>
          </div>
        )}

        {hasAccess && !profile?.btc_payout_address && (
          <div className="backdrop-blur-xl bg-yellow-900/30 border-2 border-yellow-500/50 rounded-2xl p-6 mb-8 shadow-2xl">
            <h2 className="text-xl font-bold text-yellow-200 mb-2">BTC Address Required</h2>
            <p className="text-gray-300 mb-4">
              Please set your Bitcoin payout address in your profile to download miners.
            </p>
            <Link
              href="/"
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Go to Dashboard
            </Link>
          </div>
        )}

        {/* CPU Miner Downloads */}
        {hasAccess && profile?.btc_payout_address && (
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-blue-500/10 to-white/10 border border-white/20 rounded-2xl p-8 mb-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-500/30 rounded-xl flex items-center justify-center">
                <span className="text-2xl">💻</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">CPU Miner</h2>
                <p className="text-gray-400 text-sm">Download and start mining in minutes</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* macOS Bundle */}
              <div className="p-6 bg-gradient-to-br from-green-900/20 to-blue-900/20 rounded-lg border border-green-500/30">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">🍎</span>
                      <h3 className="text-lg font-semibold text-white">macOS App Bundle</h3>
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Recommended</span>
                    </div>
                    <p className="text-sm text-gray-300 mb-3">
                      Self-contained app with embedded Python and native extension. 
                      <strong> No Terminal commands needed</strong> - just unzip and double-click!
                    </p>
                    <ul className="text-xs text-gray-400 space-y-1 mb-4">
                      <li>✓ Native C extension (~11+ MH/s)</li>
                      <li>✓ No system Python required</li>
                      <li>✓ Works on Apple Silicon and Intel Macs</li>
                    </ul>
                    <a
                      href="https://minr.online/downloads/minr-online-macos.zip"
                      download
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download macOS Bundle (~18MB)
                    </a>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 First run: If macOS blocks it, right-click the app → Open (first time only)
                    </p>
                  </div>
                </div>
              </div>

              {/* Windows/Linux HTML Launcher */}
              <div className="p-6 bg-gray-800/30 rounded-lg border border-white/10">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Windows / Linux</h3>
                    <p className="text-sm text-gray-300 mb-3">
                      Download an HTML launcher that handles installation automatically. 
                      Auto-configures from minr.online - no manual setup needed!
                    </p>
                    <button
                      onClick={async () => {
                        if (!user) {
                          alert('Please log in to download the CPU miner launcher');
                          return;
                        }
                        
                        const { data: { session } } = await supabase!.auth.getSession();
                        if (!session) {
                          alert('Please log in to download the CPU miner launcher');
                          return;
                        }
                        
                        try {
                          const response = await fetch('/api/cpu-miner-launcher', {
                            headers: { Authorization: `Bearer ${session.access_token}` },
                          });
                          
                          if (!response.ok) {
                            const errorText = await response.text();
                            let errorMessage = 'Failed to download launcher';
                            try {
                              const errorJson = JSON.parse(errorText);
                              errorMessage = errorJson.error || errorMessage;
                            } catch {
                              errorMessage = errorText || errorMessage;
                            }
                            alert(`Error: ${errorMessage}`);
                            return;
                          }
                          
                          const blob = await response.blob();
                          if (blob.size === 0) {
                            alert('Error: Downloaded file is empty. Please try again.');
                            return;
                          }
                          
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `minr-cpu-miner-launcher-${Date.now()}.html`;
                          document.body.appendChild(a);
                          a.click();
                          window.URL.revokeObjectURL(url);
                          document.body.removeChild(a);
                          
                          setTimeout(() => {
                            alert('Download complete! Open the HTML file in your browser to start mining.');
                          }, 100);
                        } catch (error: any) {
                          console.error('Download error:', error);
                          alert(`Error downloading launcher: ${error.message || 'Unknown error'}`);
                        }
                      }}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download HTML Launcher
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ASIC Miner Section */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-purple-500/10 to-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-500/30 rounded-xl flex items-center justify-center">
              <span className="text-2xl">⚡</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">ASIC Miners</h2>
              <p className="text-gray-400 text-sm">Connect Antminer, Avalon, or other ASIC miners</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-black/30 border border-white/20 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Pool URL</p>
                <div className="flex items-center gap-2">
                  <code className="text-green-400 font-mono text-sm flex-1">{STRATUM_ENDPOINT}</code>
                  <button
                    onClick={() => copyToClipboard(STRATUM_ENDPOINT, 'pool-url')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs transition-colors"
                  >
                    {copied === 'pool-url' ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="bg-black/30 border border-white/20 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Username</p>
                <div className="flex items-center gap-2">
                  <code className="text-green-400 font-mono text-sm flex-1 break-all">{BTC_ADDRESS}</code>
                  <button
                    onClick={() => copyToClipboard(BTC_ADDRESS, 'username')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs transition-colors"
                  >
                    {copied === 'username' ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="bg-black/30 border border-white/20 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Password</p>
                <div className="flex items-center gap-2">
                  <code className="text-green-400 font-mono text-sm flex-1">x</code>
                  <button
                    onClick={() => copyToClipboard('x', 'password')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs transition-colors"
                  >
                    {copied === 'password' ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="bg-black/30 border border-white/20 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Algorithm</p>
                <code className="text-green-400 font-mono text-sm">SHA-256</code>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-200">
                <strong className="text-white">Quick Setup:</strong> Use these settings in your ASIC miner's web interface. 
                The username is your Bitcoin wallet address, password is "x", and algorithm is SHA-256.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
