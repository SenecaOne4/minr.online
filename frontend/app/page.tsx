'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import LoginPage from '@/components/LoginPage';
import DashboardPage from '@/components/DashboardPage';
import HeroSection from '@/components/HeroSection';

interface SiteSettings {
  hero_title?: string;
  hero_subtitle?: string;
  hero_image_url?: string;
}

export default function Home() {
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load site settings for hero section
    loadSiteSettings();
    
    // Check for existing session (only if Supabase is configured)
    if (supabase) {
      // Check for auth errors in URL hash (e.g., expired magic link)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const error = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');
      
      if (error) {
        // Clear error hash and show error message
        window.history.replaceState(null, '', window.location.pathname);
        console.error('Auth error:', error, errorDescription);
        // Error will be handled by LoginPage component
      }

      // Handle auth callback from email link (processes hash fragments)
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });

      // Listen for auth changes (including email link callbacks)
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setUser(session?.user ?? null);
          // Clear hash fragment after processing
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        } else if (event === 'TOKEN_REFRESHED') {
          setUser(session?.user ?? null);
        } else {
          setUser(session?.user ?? null);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      // Supabase not configured - skip auth
      setLoading(false);
    }
  }, []);

  const loadSiteSettings = async () => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/admin/settings`);
      
      if (response.ok) {
        const settings = await response.json();
        setSiteSettings(settings);
      }
    } catch (error) {
      // Use defaults if settings fail to load
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-xl text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <SiteMeta settings={siteSettings || undefined} />
        <HeroSection settings={siteSettings || undefined} />
        <LoginPage />
      </>
    );
  }

  return (
    <>
      <SiteMeta settings={siteSettings || undefined} />
      <DashboardPage user={user} />
    </>
  );
}

