'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import ImageUploader from '@/components/ImageUploader';
import ImageLibrary from '@/components/ImageLibrary';

interface SiteSettings {
  id: string;
  admin_btc_wallet?: string | null;
  favicon_url?: string | null;
  logo_url?: string | null;
  og_image_url?: string | null;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  hero_image_url?: string | null;
  navigation_items?: any[] | null;
}

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'wallet' | 'branding' | 'navigation' | 'hero' | 'users' | 'mining-instances'>('wallet');
  const [miningInstances, setMiningInstances] = useState<any>(null);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminAndLoad = async () => {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          // Check if admin - also check profile for is_admin flag
          const adminCheck = session.user.email === 'senecaone4@gmail.com';
          
          // Load profile to check is_admin flag
          const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
          try {
            const profileRes = await fetch(`${apiBaseUrl}/api/profile`, {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });
            
            if (profileRes.ok) {
              const profileData = await profileRes.json();
              const isAdminFromProfile = adminCheck || profileData.is_admin === true;
              setIsAdmin(isAdminFromProfile);
              
              if (!isAdminFromProfile) {
                window.location.href = '/';
                return;
              }
            } else if (!adminCheck) {
              window.location.href = '/';
              return;
            }
          } catch (error) {
            // If profile check fails, still allow if email matches
            if (!adminCheck) {
              window.location.href = '/';
              return;
            }
            setIsAdmin(adminCheck);
          }
          
          loadSettings();
        } else {
          window.location.href = '/';
        }
        setLoading(false);
      } else {
        setLoading(false);
      }
    };
    
    checkAdminAndLoad();
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

  const loadMiningInstances = async () => {
    setLoadingInstances(true);
    try {
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/admin/mining-instances`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMiningInstances(data);
      }
    } catch (error) {
      console.error('[admin] Error loading mining instances:', error);
    } finally {
      setLoadingInstances(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'mining-instances') {
      loadMiningInstances();
      const interval = setInterval(loadMiningInstances, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const formatHashrate = (h: number): string => {
    if (h >= 1000000) return `${(h / 1000000).toFixed(2)} MH/s`;
    if (h >= 1000) return `${(h / 1000).toFixed(2)} kH/s`;
    return `${h.toFixed(2)} H/s`;
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

      // Always use relative URL for NGINX proxy
      const url = '/api/admin/settings';
      
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
            // Retry with new token using relative URL
            const retryResponse = await fetch('/api/admin/settings', {
              headers: {
                Authorization: `Bearer ${newSession.access_token}`,
                'Content-Type': 'application/json',
              },
              credentials: 'include',
            });
            if (retryResponse.ok) {
              const data = await retryResponse.json();
              setSettings(data);
            } else {
              // If still 401, user might not be admin - redirect to home
              console.error('[admin] Still unauthorized after token refresh');
              window.location.href = '/';
            }
          } else {
            // No session after refresh - redirect to login
            console.error('[admin] No session after refresh');
            window.location.href = '/';
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

  const handleSaveSettings = async (settingsToSave?: SiteSettings | null) => {
    const settingsToUse = settingsToSave || settings;
    if (!settingsToUse) return;

    setSaving(true);
    setMessage(null);

    try {
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Convert undefined to null for proper JSON serialization
      const cleanedSettings = {
        ...settingsToUse,
        favicon_url: settingsToUse.favicon_url || null,
        logo_url: settingsToUse.logo_url || null,
        og_image_url: settingsToUse.og_image_url || null,
        hero_image_url: settingsToUse.hero_image_url || null,
      };

      // Use relative URL for NGINX proxy
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(cleanedSettings),
      });

      if (response.ok) {
        const savedData = await response.json();
        setSettings(savedData);
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

  const handleSave = async () => {
    await handleSaveSettings();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
        <div className="text-xl text-white">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
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
                } else if (tab === 'mining-instances') {
                  loadMiningInstances();
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
                    selectedPath={settings?.favicon_url || undefined}
                    onSelect={(image) => {
                      setSettings({ ...settings, favicon_url: image.url } as SiteSettings);
                    }}
                  />
                </div>
                {settings?.favicon_url && (
                  <div className="mt-4 flex items-center gap-4">
                    <div className="relative">
                      <img 
                        src={settings.favicon_url} 
                        alt="Favicon" 
                        className="w-16 h-16 rounded-lg border-2 border-white/20 object-cover"
                        title={`Favicon URL: ${settings.favicon_url}`}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          console.error(`[Admin] Failed to load favicon:`, settings.favicon_url);
                          target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect fill="%23999" width="64" height="64"/%3E%3Ctext fill="%23fff" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="10"%3EImage%3C/text%3E%3C/svg%3E';
                        }}
                        onLoad={() => {
                          console.log(`[Admin] Successfully loaded favicon:`, settings.favicon_url);
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(settings.favicon_url || '');
                          setMessage('Favicon URL copied to clipboard');
                          setTimeout(() => setMessage(null), 2000);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
                        title="Copy URL"
                      >
                        Copy URL
                      </button>
                      <button
                        onClick={async () => {
                          const updatedSettings = { ...settings, favicon_url: null } as SiteSettings;
                          setSettings(updatedSettings);
                          // Auto-save the removal
                          await handleSaveSettings(updatedSettings);
                        }}
                        className="text-red-400 hover:text-red-300 text-sm transition-colors"
                      >
                        Remove
                      </button>
                    </div>
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
                    selectedPath={settings?.logo_url || undefined}
                    onSelect={(image) => {
                      setSettings({ ...settings, logo_url: image.url } as SiteSettings);
                    }}
                  />
                </div>
                {settings?.logo_url && (
                  <div className="mt-4 flex items-center gap-4">
                    <div className="relative">
                      <img 
                        src={settings.logo_url} 
                        alt="Site Logo" 
                        className="max-w-md h-32 object-contain rounded-lg border-2 border-white/20"
                        title={`Logo URL: ${settings.logo_url}`}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          console.error(`[Admin] Failed to load logo:`, settings.logo_url);
                          target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200"%3E%3Crect fill="%23999" width="400" height="200"/%3E%3Ctext fill="%23fff" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage not found%3C/text%3E%3C/svg%3E';
                        }}
                        onLoad={() => {
                          console.log(`[Admin] Successfully loaded logo:`, settings.logo_url);
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(settings.logo_url || '');
                          setMessage('Logo URL copied to clipboard');
                          setTimeout(() => setMessage(null), 2000);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
                        title="Copy URL"
                      >
                        Copy URL
                      </button>
                      <button
                        onClick={async () => {
                          const updatedSettings = { ...settings, logo_url: null } as SiteSettings;
                          setSettings(updatedSettings);
                          await handleSaveSettings(updatedSettings);
                        }}
                        className="text-red-400 hover:text-red-300 text-sm transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* OG Image */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Open Graph Image</label>
                <ImageUploader folder="og-images" onUploadComplete={(url) => {
                  setSettings({ ...settings, og_image_url: url } as SiteSettings);
                }} />
                <div className="mt-4">
                  <ImageLibrary
                    folder="og-images"
                    selectedPath={settings?.og_image_url || undefined}
                    onSelect={(image) => {
                      setSettings({ ...settings, og_image_url: image.url } as SiteSettings);
                    }}
                  />
                </div>
                {settings?.og_image_url && (
                  <div className="mt-4 flex items-center gap-4">
                    <div className="relative">
                      <img 
                        src={settings.og_image_url} 
                        alt="OG Image" 
                        className="w-32 h-32 rounded-lg border-2 border-white/20 object-cover"
                        title={`OG Image URL: ${settings.og_image_url}`}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          console.error(`[Admin] Failed to load OG image:`, settings.og_image_url);
                          target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="128"%3E%3Crect fill="%23999" width="128" height="128"/%3E%3Ctext fill="%23fff" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="12"%3EImage%3C/text%3E%3C/svg%3E';
                        }}
                        onLoad={() => {
                          console.log(`[Admin] Successfully loaded OG image:`, settings.og_image_url);
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(settings.og_image_url || '');
                          setMessage('OG Image URL copied to clipboard');
                          setTimeout(() => setMessage(null), 2000);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
                        title="Copy URL"
                      >
                        Copy URL
                      </button>
                      <button
                        onClick={async () => {
                          const updatedSettings = { ...settings, og_image_url: null } as SiteSettings;
                          setSettings(updatedSettings);
                          await handleSaveSettings(updatedSettings);
                        }}
                        className="text-red-400 hover:text-red-300 text-sm transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'navigation' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Navigation</h2>
              <p className="text-gray-400 mb-6">Configure navigation menu items</p>
              
              <div className="space-y-4">
                {(settings?.navigation_items || []).map((item: { label: string; href: string }, index: number) => (
                  <div key={index} className="flex gap-2 items-center backdrop-blur-xl bg-white/5 border border-white/20 rounded-xl p-4">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => {
                          if (index > 0) {
                            const newItems = [...(settings?.navigation_items || [])];
                            [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
                            setSettings({ ...settings, navigation_items: newItems } as SiteSettings);
                          }
                        }}
                        disabled={index === 0}
                        className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => {
                          const items = settings?.navigation_items || [];
                          if (index < items.length - 1) {
                            const newItems = [...items];
                            [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
                            setSettings({ ...settings, navigation_items: newItems } as SiteSettings);
                          }
                        }}
                        disabled={index === (settings?.navigation_items || []).length - 1}
                        className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Label</label>
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => {
                            const newItems = [...(settings?.navigation_items || [])];
                            newItems[index] = { ...newItems[index], label: e.target.value };
                            setSettings({ ...settings, navigation_items: newItems } as SiteSettings);
                          }}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                          placeholder="Menu Label"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">URL</label>
                        <input
                          type="text"
                          value={item.href}
                          onChange={(e) => {
                            const newItems = [...(settings?.navigation_items || [])];
                            newItems[index] = { ...newItems[index], href: e.target.value };
                            setSettings({ ...settings, navigation_items: newItems } as SiteSettings);
                          }}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 backdrop-blur-sm font-mono text-sm"
                          placeholder="/path"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const newItems = [...(settings?.navigation_items || [])];
                        newItems.splice(index, 1);
                        setSettings({ ...settings, navigation_items: newItems } as SiteSettings);
                      }}
                      className="text-red-400 hover:text-red-300 px-3 py-2 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                
                <button
                  onClick={() => {
                    const newItems = [...(settings?.navigation_items || []), { label: '', href: '' }];
                    setSettings({ ...settings, navigation_items: newItems } as SiteSettings);
                  }}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                >
                  + Add Navigation Item
                </button>
                
                {(settings?.navigation_items || []).length === 0 && (
                  <p className="text-gray-400 text-center py-8">No navigation items. Click "Add Navigation Item" to create one.</p>
                )}
              </div>
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
                <div className="mt-4">
                  <ImageLibrary
                    folder="hero-images"
                    selectedPath={settings?.hero_image_url || undefined}
                    onSelect={(image) => {
                      setSettings({ ...settings, hero_image_url: image.url } as SiteSettings);
                    }}
                  />
                </div>
                {settings?.hero_image_url && (
                  <div className="mt-4 flex items-center gap-4">
                    <div className="relative">
                      <img 
                        src={settings.hero_image_url} 
                        alt="Hero Background" 
                        className="w-48 h-32 rounded-lg border-2 border-white/20 object-cover"
                        title={`Hero Image URL: ${settings.hero_image_url}`}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          console.error(`[Admin] Failed to load hero image:`, settings.hero_image_url);
                          target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="192" height="128"%3E%3Crect fill="%23999" width="192" height="128"/%3E%3Ctext fill="%23fff" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="12"%3EImage%3C/text%3E%3C/svg%3E';
                        }}
                        onLoad={() => {
                          console.log(`[Admin] Successfully loaded hero image:`, settings.hero_image_url);
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(settings.hero_image_url || '');
                          setMessage('Hero Image URL copied to clipboard');
                          setTimeout(() => setMessage(null), 2000);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
                        title="Copy URL"
                      >
                        Copy URL
                      </button>
                      <button
                        onClick={async () => {
                          const updatedSettings = { ...settings, hero_image_url: null } as SiteSettings;
                          setSettings(updatedSettings);
                          await handleSaveSettings(updatedSettings);
                        }}
                        className="text-red-400 hover:text-red-300 text-sm transition-colors"
                      >
                        Remove
                      </button>
                    </div>
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

