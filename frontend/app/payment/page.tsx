'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import PaymentGate from '@/components/PaymentGate';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

export default function PaymentPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session.user);
        }
        setLoading(false);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

      return () => subscription.unsubscribe();
    } else {
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <Navbar userEmail={undefined} />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Authentication Required</h1>
            <p className="text-gray-400 mb-6">Please log in to access the payment page</p>
            <Link
              href="/"
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Navbar userEmail={user.email} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Payment</h1>
          <p className="text-gray-400">Pay $1 USD entry fee to start mining</p>
        </div>

        <PaymentGate />

        <div className="mt-8 backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-4">Payment Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Scan the QR code with your Bitcoin wallet, or copy the Bitcoin address</li>
            <li>Send exactly {parseFloat('1.00').toFixed(8)} BTC (approximately $1.00 USD)</li>
            <li>Wait for payment confirmation (usually takes 1-2 minutes)</li>
            <li>Once confirmed, you'll be redirected to the dashboard</li>
          </ol>
          <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
            <p className="text-yellow-200 text-sm">
              <strong>Note:</strong> Payment requests expire after 24 hours. Make sure to complete your payment within this time.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

