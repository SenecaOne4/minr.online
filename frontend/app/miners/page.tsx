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
      
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Miner Instructions
          </h1>
          <p className="text-xl text-gray-300">
            Connect your CPU miner, ASIC miner, or download our desktop miner
          </p>
        </div>

        {!hasAccess && (
          <div className="backdrop-blur-xl bg-red-900/30 border-2 border-red-500/50 rounded-2xl p-6 mb-8 shadow-2xl">
            <h2 className="text-xl font-bold text-red-200 mb-2">Entry Fee Required</h2>
            <p className="text-gray-300 mb-4">
              You must pay the $1 USD entry fee to access mining instructions and connect external miners.
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
              Please set your Bitcoin payout address in your profile to use these instructions.
            </p>
            <Link
              href="/"
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Go to Dashboard
            </Link>
          </div>
        )}

        {/* Desktop Miner Download Section */}
        {hasAccess && profile?.btc_payout_address && (
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-blue-500/10 to-white/10 border border-white/20 rounded-2xl p-8 mb-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-500/30 rounded-xl flex items-center justify-center">
                <span className="text-2xl">💻</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Desktop Miner</h2>
                <p className="text-gray-400 text-sm">Choose your preferred miner type</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* HTML Miner Option */}
              <div className="p-4 bg-gray-800/30 rounded-lg border border-white/10">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Browser Miner (HTML)</h3>
                    <p className="text-sm text-gray-400">Easy to use, no installation required</p>
                  </div>
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Easy</span>
                </div>
                <p className="text-sm text-gray-300 mb-3">
                  Download a standalone HTML file that runs in your browser. Perfect for quick testing or low-resource mining.
                </p>
                <button
                  onClick={async (e) => {
                    if (!user) {
                      alert('Please log in to download the miner');
                      return;
                    }
                    const { data: { session } } = await supabase!.auth.getSession();
                    if (!session) {
                      alert('Please log in to download the miner');
                      return;
                    }
                    
                    try {
                      const response = await fetch('/api/standalone-miner', {
                        headers: { Authorization: `Bearer ${session.access_token}` },
                      });
                      
                      if (!response.ok) {
                        const errorText = await response.text();
                        let errorMessage = 'Failed to download miner';
                        try {
                          const errorJson = JSON.parse(errorText);
                          errorMessage = errorJson.error || errorMessage;
                        } catch {
                          errorMessage = errorText || errorMessage;
                        }
                        alert(`Error: ${errorMessage}`);
                        return;
                      }
                      
                      // Verify content type
                      const contentType = response.headers.get('content-type');
                      console.log('Download response - Content-Type:', contentType, 'Status:', response.status);
                      
                      const blob = await response.blob();
                      console.log('Blob type:', blob.type, 'size:', blob.size);
                      
                      // Check if blob is empty
                      if (blob.size === 0) {
                        alert('Error: Downloaded file is empty. Please try again.');
                        return;
                      }
                      
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `minr-desktop-miner-${Date.now()}.html`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                      
                      // Show success message
                      setTimeout(() => {
                        alert('Download complete! Open the HTML file in your browser to start mining.');
                      }, 100);
                    } catch (error: any) {
                      console.error('Download error:', error);
                      alert(`Error downloading miner: ${error.message || 'Unknown error'}`);
                    }
                  }}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download HTML Miner
                </button>
              </div>

              {/* CPU Miner Option */}
              <div className="p-4 bg-gray-800/30 rounded-lg border border-white/10">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">CPU Miner (cpuminer)</h3>
                    <p className="text-sm text-gray-400">High performance, native C code - 10-100x faster</p>
                  </div>
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">Fast</span>
                </div>
                <p className="text-sm text-gray-300 mb-3">
                  Download an HTML launcher that handles one-click installation of dependencies and cpuminer. 
                  Auto-configures from minr.online - no manual setup needed!
                </p>
                <button
                  onClick={async (e) => {
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
                      
                      // Verify content type
                      const contentType = response.headers.get('content-type');
                      console.log('Download response - Content-Type:', contentType, 'Status:', response.status);
                      
                      const blob = await response.blob();
                      console.log('Blob type:', blob.type, 'size:', blob.size);
                      
                      // Check if blob is empty
                      if (blob.size === 0) {
                        alert('Error: Downloaded file is empty. Please try again.');
                        return;
                      }
                      
                      // Verify it's HTML
                      if (!blob.type.includes('html') && !contentType?.includes('html')) {
                        console.warn('Warning: Content-Type is not HTML:', contentType);
                      }
                      
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `minr-cpu-miner-launcher-${Date.now()}.html`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                      
                      // Show success message
                      setTimeout(() => {
                        alert('Download complete! Open the HTML file in your browser to start mining.');
                      }, 100);
                    } catch (error: any) {
                      console.error('Download error:', error);
                      alert(`Error downloading launcher: ${error.message || 'Unknown error'}`);
                    }
                  }}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download CPU Miner Launcher
                </button>
              </div>

              <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-200">
                  <strong className="text-white">Note:</strong> All miners auto-configure from minr.online. 
                  Endpoints and settings are managed on our site - no manual configuration needed. 
                  The modified cpuminer will fetch your personalized config automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ASIC Miner Section */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-purple-500/10 to-white/10 border border-white/20 rounded-2xl p-8 mb-8 shadow-2xl">
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
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Connection Settings</h3>
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
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Antminer Configuration</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-300">
                <li>Access your Antminer web interface (usually http://192.168.1.99)</li>
                <li>Go to Configuration → Miner Configuration</li>
                <li>Set Pool URL to: <code className="bg-black/50 px-2 py-1 rounded text-green-400 font-mono text-sm">{STRATUM_ENDPOINT}</code></li>
                <li>Set Worker to: <code className="bg-black/50 px-2 py-1 rounded text-green-400 font-mono text-sm">{BTC_ADDRESS}</code></li>
                <li>Set Password to: <code className="bg-black/50 px-2 py-1 rounded text-green-400 font-mono text-sm">x</code></li>
                <li>Save and restart the miner</li>
              </ol>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Other ASIC Miners</h3>
              <p className="text-gray-300">
                For Avalon, Whatsminer, or other ASIC miners, use the same connection settings above. 
                The configuration interface may vary, but the pool URL, username (Bitcoin address), and password (x) remain the same.
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Miner Section */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-pink-500/10 to-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-pink-500/30 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🐍</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Desktop Miner (Python)</h2>
              <p className="text-gray-400 text-sm">Pre-configured Python miner script</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Download & Run</h3>
              <p className="text-gray-300 mb-4">
                Download the pre-configured miner script from your dashboard. The script includes:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-300 mb-4">
                <li>Your Bitcoin wallet address pre-configured</li>
                <li>Connection settings to the pool</li>
                <li>GUI and CLI modes</li>
                <li>Statistics reporting</li>
              </ul>
              <Link
                href="/"
                className="inline-block bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Go to Dashboard to Download
              </Link>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Usage</h3>
              <div className="bg-black/50 border border-white/20 rounded-lg p-4">
                <pre className="text-green-400 font-mono text-sm">
                  <code>{`# GUI mode (default)
python minr-miner.py

# CLI mode
python minr-miner.py --cli`}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Troubleshooting */}
        <div className="mt-8 backdrop-blur-xl bg-gradient-to-br from-white/10 via-gray-500/10 to-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-4">Troubleshooting</h2>
          <div className="space-y-4 text-gray-300">
            <div>
              <h3 className="font-semibold text-white mb-1">Connection Refused</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Verify entry fee is paid</li>
                <li>Check Bitcoin address is set in profile</li>
                <li>Ensure miner is using correct endpoint</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">Shares Not Accepted</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Check difficulty is appropriate for your hardware</li>
                <li>Verify miner is using correct username (Bitcoin address)</li>
                <li>Check pool difficulty settings</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">Authentication Failed</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Ensure username is your Bitcoin wallet address</li>
                <li>Password should be exactly: <code className="bg-black/50 px-1 rounded">x</code></li>
                <li>Verify account has paid entry fee</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

