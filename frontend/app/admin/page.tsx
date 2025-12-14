'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import ImageUploader from '@/components/ImageUploader';
import ImageLibrary from '@/components/ImageLibrary';

interface SiteSettings {
  id: string;
  admin_btc_wallet?: string;
  favicon_url?: string;
  logo_url?: string;
  og_image_url?: string;
  hero_title?: string;
  hero_subtitle?: string;
  hero_image_url?: string;
  navigation_items?: any[];
}

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'wallet' | 'branding' | 'navigation' | 'hero' | 'users'>('wallet');
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session.user);
          // Check if admin
          const adminCheck = session.user.email === 'senecaone4@gmail.com';
          setIsAdmin(adminCheck);
          if (!adminCheck) {
            window.location.href = '/';
            return;
          }
          loadSettings();
        } else {
          window.location.href = '/';
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('[admin] Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleMakeAdmin = async (userId: string) => {
    if (!confirm('Make this user an admin?')) return;

    try {
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/make-admin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        loadUsers();
      }
    } catch (error) {
      console.error('[admin] Error making admin:', error);
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (!confirm('Remove admin status from this user?')) return;

    try {
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/remove-admin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        loadUsers();
      }
    } catch (error) {
      console.error('[admin] Error removing admin:', error);
    }
  };

  const handleExemptFee = async (userId: string, exempt: boolean) => {
    try {
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/exempt-fee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ exempt }),
      });

      if (response.ok) {
        loadUsers();
      }
    } catch (error) {
      console.error('[admin] Error updating fee exemption:', error);
    }
  };

  const loadSettings = async () => {
    try {
      if (!supabase) {
        console.error('[admin] Supabase not configured');
        return;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('[admin] Session error:', sessionError);
        return;
      }
      
      if (!session) {
        console.error('[admin] No session found');
        return;
      }

      if (!session.access_token) {
        console.error('[admin] No access token in session');
        return;
      }

      // Use absolute URL if NEXT_PUBLIC_API_URL is set, otherwise use relative
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const url = apiBaseUrl ? `${apiBaseUrl}/api/admin/settings` : '/api/admin/settings';
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for CORS
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[admin] Settings fetch failed:', response.status, errorText);
        if (response.status === 401) {
          // Token might be expired, try to refresh
          const { data: { session: newSession } } = await supabase.auth.refreshSession();
          if (newSession?.access_token) {
            // Retry with new token
            const retryResponse = await fetch(`${apiBaseUrl}/api/admin/settings`, {
              headers: {
                Authorization: `Bearer ${newSession.access_token}`,
                'Content-Type': 'application/json',
              },
            });
            if (retryResponse.ok) {
              const data = await retryResponse.json();
              setSettings(data);
            }
          }
        }
        return;
      }

      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('[admin] Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/admin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage('Settings saved successfully!');
        setTimeout(() => setMessage(null), 3000);
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-xl text-white">Loading...</div>
      </div>
    );
  }

  if (!user || user.email !== 'senecaone4@gmail.com') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Navbar userEmail={user.email} isAdmin={isAdmin} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Admin Settings</h1>
          <p className="text-gray-400">Manage site configuration and branding</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/20">
          {(['wallet', 'branding', 'navigation', 'hero', 'users'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'users') {
                  loadUsers();
                }
              }}
              className={`px-6 py-3 font-semibold transition-all duration-200 border-b-2 ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-purple-500/10 to-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
          {activeTab === 'wallet' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Bitcoin Wallet</h2>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Admin BTC Wallet Address
                </label>
                <input
                  type="text"
                  value={settings?.admin_btc_wallet || ''}
                  onChange={(e) => setSettings({ ...settings, admin_btc_wallet: e.target.value } as SiteSettings)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="bc1..."
                />
                <p className="text-xs text-gray-400 mt-2">
                  This wallet receives lottery pool payouts and is used for mining authorization
                </p>
              </div>
            </div>
          )}

          {activeTab === 'branding' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white mb-4">Branding</h2>
              
              {/* Favicon */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Favicon</label>
                <ImageUploader folder="favicons" onUploadComplete={(url) => {
                  setSettings({ ...settings, favicon_url: url } as SiteSettings);
                }} />
                <div className="mt-4">
                  <ImageLibrary
                    folder="favicons"
                    selectedPath={settings?.favicon_url}
                    onSelect={(image) => {
                      setSettings({ ...settings, favicon_url: image.url } as SiteSettings);
                    }}
                  />
                </div>
                {settings?.favicon_url && (
                  <div className="mt-4 flex items-center gap-4">
                    <img src={settings.favicon_url} alt="Favicon" className="w-16 h-16 rounded-lg border-2 border-white/20" />
                    <button
                      onClick={() => setSettings({ ...settings, favicon_url: undefined } as SiteSettings)}
                      className="text-red-400 hover:text-red-300 text-sm transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Logo */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Site Logo</label>
                <ImageUploader folder="logos" onUploadComplete={(url) => {
                  setSettings({ ...settings, logo_url: url } as SiteSettings);
                }} />
                <div className="mt-4">
                  <ImageLibrary
                    folder="logos"
                    selectedPath={settings?.logo_url}
                    onSelect={(image) => {
                      setSettings({ ...settings, logo_url: image.url } as SiteSettings);
                    }}
                  />
                </div>
              </div>

              {/* OG Image */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Open Graph Image</label>
                <ImageUploader folder="og-images" onUploadComplete={(url) => {
                  setSettings({ ...settings, og_image_url: url } as SiteSettings);
                }} />
                {settings?.og_image_url && (
                  <div className="mt-4">
                    <img src={settings.og_image_url} alt="OG Image" className="max-w-md rounded-lg" />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'navigation' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Navigation</h2>
              <p className="text-gray-400">Navigation configuration coming soon</p>
            </div>
          )}

          {activeTab === 'hero' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Hero Section</h2>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                <input
                  type="text"
                  value={settings?.hero_title || ''}
                  onChange={(e) => setSettings({ ...settings, hero_title: e.target.value } as SiteSettings)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Subtitle</label>
                <input
                  type="text"
                  value={settings?.hero_subtitle || ''}
                  onChange={(e) => setSettings({ ...settings, hero_subtitle: e.target.value } as SiteSettings)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Background Image</label>
                <ImageUploader folder="hero-images" onUploadComplete={(url) => {
                  setSettings({ ...settings, hero_image_url: url } as SiteSettings);
                }} />
                {settings?.hero_image_url && (
                  <div className="mt-4">
                    <img src={settings.hero_image_url} alt="Hero" className="max-w-md rounded-lg" />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">User Management</h2>
              {loadingUsers ? (
                <div className="text-center text-white py-8">Loading users...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="px-4 py-3 text-gray-300 font-semibold">Email</th>
                        <th className="px-4 py-3 text-gray-300 font-semibold">Username</th>
                        <th className="px-4 py-3 text-gray-300 font-semibold">Admin</th>
                        <th className="px-4 py-3 text-gray-300 font-semibold">Paid Entry</th>
                        <th className="px-4 py-3 text-gray-300 font-semibold">Exempt</th>
                        <th className="px-4 py-3 text-gray-300 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-white/10 hover:bg-white/5">
                          <td className="px-4 py-3 text-white">{u.email || 'N/A'}</td>
                          <td className="px-4 py-3 text-gray-300">{u.username || '-'}</td>
                          <td className="px-4 py-3">
                            {u.is_admin ? (
                              <span className="text-green-400 font-semibold">Yes</span>
                            ) : (
                              <span className="text-gray-400">No</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {u.has_paid_entry_fee ? (
                              <span className="text-green-400">Yes</span>
                            ) : (
                              <span className="text-red-400">No</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {u.exempt_from_entry_fee ? (
                              <span className="text-yellow-400">Yes</span>
                            ) : (
                              <span className="text-gray-400">No</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 flex-wrap">
                              {!u.is_admin && (
                                <button
                                  onClick={() => handleMakeAdmin(u.id)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                                >
                                  Make Admin
                                </button>
                              )}
                              {u.is_admin && u.id !== user?.id && (
                                <button
                                  onClick={() => handleRemoveAdmin(u.id)}
                                  className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                                >
                                  Remove Admin
                                </button>
                              )}
                              {!u.exempt_from_entry_fee ? (
                                <button
                                  onClick={() => handleExemptFee(u.id, true)}
                                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                                >
                                  Exempt Fee
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleExemptFee(u.id, false)}
                                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                                >
                                  Remove Exempt
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && (
                    <div className="text-center text-gray-400 py-8">No users found</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Save Button */}
          <div className="mt-8 pt-6 border-t border-white/20">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-xl hover:shadow-2xl disabled:opacity-50 transform hover:scale-[1.02]"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {message && (
              <div className={`mt-4 p-3 rounded-lg ${
                message.includes('Error')
                  ? 'bg-red-900/30 border border-red-500/50 text-red-200'
                  : 'bg-green-900/30 border border-green-500/50 text-green-200'
              }`}>
                {message}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

