'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';

interface PaymentRequest {
  id: string;
  btc_address: string;
  amount_btc: string;
  amount_usd: number;
  expires_at: string;
  status: string;
}

export default function PaymentGate() {
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    createPaymentRequest();
  }, []);

  useEffect(() => {
    if (!paymentRequest || paymentRequest.status === 'paid') return;

    // Check payment status every 10 seconds
    const interval = setInterval(() => {
      checkPaymentStatus();
    }, 10000);

    // Update countdown timer
    const timerInterval = setInterval(() => {
      if (paymentRequest.expires_at) {
        const expires = new Date(paymentRequest.expires_at).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((expires - now) / 1000));
        setTimeRemaining(remaining);
        
        if (remaining === 0) {
          setPaymentRequest(prev => prev ? { ...prev, status: 'expired' } : null);
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timerInterval);
    };
  }, [paymentRequest]);

  const createPaymentRequest = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!supabase) {
        throw new Error('Supabase not configured');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/payments/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment request');
      }

      const data = await response.json();
      setPaymentRequest(data);
      
      // Calculate initial time remaining
      if (data.expires_at) {
        const expires = new Date(data.expires_at).getTime();
        const now = Date.now();
        setTimeRemaining(Math.max(0, Math.floor((expires - now) / 1000)));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create payment request');
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!paymentRequest || paymentRequest.status === 'paid') return;

    try {
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/payments/status/${paymentRequest.id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentRequest(data);
        
        if (data.status === 'paid') {
          // Reload page to show dashboard
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      }
    } catch (err) {
      console.error('Error checking payment status:', err);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
        <div className="text-center">
          <div className="text-white text-lg mb-2">Creating payment request...</div>
          <div className="text-gray-400 text-sm">Please wait</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-red-500/50 rounded-2xl p-6 shadow-2xl">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">Error</div>
          <div className="text-gray-300 text-sm mb-4">{error}</div>
          <button
            onClick={createPaymentRequest}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!paymentRequest) {
    return null;
  }

  if (paymentRequest.status === 'paid') {
    return (
      <div className="backdrop-blur-xl bg-gradient-to-br from-green-900/30 via-green-800/20 to-green-900/30 border border-green-500/50 rounded-2xl p-6 shadow-2xl">
        <div className="text-center">
          <div className="text-green-400 text-2xl font-bold mb-2">✅ Payment Confirmed!</div>
          <div className="text-gray-300 text-sm">You can now start mining</div>
        </div>
      </div>
    );
  }

  if (paymentRequest.status === 'expired') {
    return (
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-yellow-500/50 rounded-2xl p-6 shadow-2xl">
        <div className="text-center">
          <div className="text-yellow-400 text-lg mb-2">Payment Request Expired</div>
          <div className="text-gray-300 text-sm mb-4">Please create a new payment request</div>
          <button
            onClick={createPaymentRequest}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Create New Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
      <h2 className="text-2xl font-bold mb-4 text-white">Pay Entry Fee</h2>
      <p className="text-gray-300 mb-6">
        To start mining, please pay <span className="font-bold text-white">$1.00 USD</span> in Bitcoin
      </p>

      <div className="space-y-4">
        {/* QR Code */}
        <div className="flex justify-center bg-white p-4 rounded-xl">
          <QRCodeSVG
            value={`bitcoin:${paymentRequest.btc_address}?amount=${paymentRequest.amount_btc}`}
            size={200}
            level="M"
            includeMargin={true}
          />
        </div>

        {/* Bitcoin Address */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Bitcoin Address
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={paymentRequest.btc_address}
              readOnly
              className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(paymentRequest.btc_address);
              }}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl transition-all duration-200 border border-white/20"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Amount */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount (BTC)
            </label>
            <div className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white font-mono">
              {parseFloat(paymentRequest.amount_btc).toFixed(8)}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount (USD)
            </label>
            <div className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white font-mono">
              ${paymentRequest.amount_usd.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Timer */}
        {timeRemaining !== null && timeRemaining > 0 && (
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-1">Time remaining</div>
            <div className="text-xl font-bold text-yellow-400">{formatTime(timeRemaining)}</div>
          </div>
        )}

        {/* Status */}
        <div className="text-center">
          <div className="text-sm text-gray-400 mb-2">Status: {paymentRequest.status}</div>
          <button
            onClick={checkPaymentStatus}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Check Payment Status
          </button>
        </div>

        <div className="text-xs text-gray-400 text-center mt-4">
          Payment is verified automatically. This page will refresh when payment is confirmed.
        </div>
      </div>
    </div>
  );
}

