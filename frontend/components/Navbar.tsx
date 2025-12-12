'use client';

import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface NavbarProps {
  userEmail?: string;
}

export default function Navbar({ userEmail }: NavbarProps) {
  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  return (
    <nav className="backdrop-blur-lg bg-white/10 border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-white hover:text-gray-200 transition-colors">
              Minr.online
            </Link>
            <div className="hidden md:flex space-x-4">
              <Link href="/" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">
                Dashboard
              </Link>
              <Link href="/miner" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">
                Miner
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {userEmail && (
              <span className="text-sm text-gray-300 hidden sm:block">{userEmail}</span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-red-400 hover:text-red-300 px-3 py-2 rounded-md transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

