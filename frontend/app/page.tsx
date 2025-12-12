'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import LoginPage from '@/components/LoginPage';
import DashboardPage from '@/components/DashboardPage';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session (only if Supabase is configured)
    if (supabase) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-xl text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <DashboardPage user={user} />;
}

