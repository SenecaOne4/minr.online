'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ProfileDropdown from './ProfileDropdown';

interface NavbarProps {
  userEmail?: string;
  isAdmin?: boolean;
}

interface NavigationItem {
  label: string;
  href: string;
}

export default function Navbar({ userEmail, isAdmin }: NavbarProps) {
  const [navigationItems, setNavigationItems] = useState<NavigationItem[]>([]);

  useEffect(() => {
    loadNavigationSettings();
  }, []);

  const loadNavigationSettings = async () => {
    try {
      // Use relative URL for NGINX proxy
      const response = await fetch('/api/admin/settings/public');
      
      if (response.ok) {
        const settings = await response.json();
        if (settings.navigation_items && Array.isArray(settings.navigation_items)) {
          setNavigationItems(settings.navigation_items);
        }
      }
    } catch (error) {
      // Use default navigation if settings fail
      console.error('Error loading navigation settings:', error);
      setNavigationItems([
        { label: 'Dashboard', href: '/' },
        { label: 'Miner', href: '/miner' },
      ]);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  // Default navigation if settings not loaded
  const defaultNav: NavigationItem[] = [
    { label: 'Dashboard', href: '/' },
    { label: 'Miner', href: '/miner' },
  ];
  
  const navItems = navigationItems.length > 0 ? navigationItems : defaultNav;

  return (
    <nav className="backdrop-blur-lg bg-white/10 border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-white hover:text-gray-200 transition-colors">
              Minr.online
            </Link>
            <div className="hidden md:flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-yellow-400 hover:text-yellow-300 px-3 py-2 rounded-md text-sm font-medium transition-colors border border-yellow-400/50"
                >
                  Admin
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {userEmail ? (
              <ProfileDropdown userEmail={userEmail} onLogout={handleLogout} />
            ) : (
              <Link
                href="/"
                className="text-sm text-gray-300 hover:text-white px-3 py-2 rounded-md transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

