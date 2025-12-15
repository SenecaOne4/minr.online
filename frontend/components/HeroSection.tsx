'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface SiteSettings {
  hero_title?: string;
  hero_subtitle?: string;
  hero_image_url?: string;
}

interface HeroSectionProps {
  settings?: SiteSettings;
}

export default function HeroSection({ settings }: HeroSectionProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [imageError, setImageError] = useState(false);
  
  const title = settings?.hero_title || 'Minr.online';
  const subtitle = settings?.hero_subtitle || 'Bitcoin Lottery Pool Mining Platform';
  const backgroundImage = settings?.hero_image_url;

  // Reset image error when background image changes
  useEffect(() => {
    setImageError(false);
  }, [backgroundImage]);

  // Check for auth errors in URL hash on mount
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const error = hashParams.get('error');
    const errorDescription = hashParams.get('error_description');
    
    if (error === 'access_denied' && errorDescription) {
      const decodedError = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
      if (decodedError.includes('expired')) {
        setMessage('The magic link has expired. Please request a new one.');
      } else {
        setMessage(`Authentication error: ${decodedError}`);
      }
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!supabase) {
      setMessage('Error: Supabase not configured');
      setLoading(false);
      return;
    }

    const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    
    if (usePassword && password) {
      // Password login
      const trimmedEmail = email.trim();
      
      if (!trimmedEmail) {
        setMessage('Error: Please enter your email address.');
        setLoading(false);
        return;
      }
      
      if (!password) {
        setMessage('Error: Please enter your password.');
        setLoading(false);
        return;
      }
      
      // Log input values for debugging (without exposing password)
      console.log('Password login attempt:', { 
        email: trimmedEmail, 
        emailLength: trimmedEmail.length,
        passwordLength: password.length,
        hasPassword: !!password,
        userAgent: navigator.userAgent 
      });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail.toLowerCase(), // Normalize email to lowercase
        password: password.trim(), // Trim password whitespace
      });

      if (error) {
        // Log the full error for debugging
        console.error('Password login error:', {
          message: error.message,
          status: error.status,
          code: error.code,
          name: error.name,
          fullError: JSON.stringify(error, null, 2)
        });
        
        // More detailed error handling
        const errorMsg = (error.message || '').toLowerCase();
        const errorCode = error.status || error.code || '';
        const errorName = error.name || '';
        
        // Handle specific Supabase error codes
        if (errorCode === 400 || errorMsg.includes('invalid login credentials') || errorMsg.includes('invalid') || errorMsg.includes('email') || errorMsg.includes('credential')) {
          setMessage('Error: Invalid email or password. If you haven\'t set a password yet, please use "Magic Link" login first, then set a password in your profile settings.');
        } else if (errorMsg.includes('email not confirmed') || errorMsg.includes('not confirmed') || errorCode === 'email_not_confirmed') {
          setMessage('Error: Please confirm your email first. Check your inbox for a confirmation link, or use Magic Link login.');
        } else if (errorMsg.includes('user not found') || errorCode === 'user_not_found') {
          setMessage('Error: No account found with this email. Please sign up first using Magic Link login.');
        } else if (errorMsg.includes('password') || errorCode === 'invalid_credentials' || errorName === 'AuthApiError') {
          setMessage('Error: Password authentication failed. Make sure you have set a password in your profile settings, or use Magic Link login.');
        } else {
          setMessage(`Error: ${error.message || 'Authentication failed'}. Try using Magic Link login instead.`);
        }
        setLoading(false);
        return;
      }
      
      if (data?.session) {
        // Success - page will redirect automatically
        setMessage('Login successful! Redirecting...');
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
        return;
      }
    } else {
      // Magic link login
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${redirectUrl}/`,
        },
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage('Check your email for the login link!');
      }
    }

    setLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 z-0" />
      
      {/* Christmas Banner */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-600 via-green-600 via-yellow-500 to-red-600 border-b-4 border-yellow-400 shadow-2xl overflow-hidden">
        <div className="relative py-4 px-4">
          {/* Animated twinkling lights border */}
          <div className="absolute top-0 left-0 right-0 h-1 flex gap-1">
            {[...Array(50)].map((_, i) => (
              <div
                key={`top-${i}`}
                className="flex-1 h-full bg-yellow-300 rounded-full twinkle-light"
                style={{
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 flex gap-1">
            {[...Array(50)].map((_, i) => (
              <div
                key={`bottom-${i}`}
                className="flex-1 h-full bg-yellow-300 rounded-full twinkle-light"
                style={{
                  animationDelay: `${(i + 25) * 0.1}s`,
                }}
              />
            ))}
          </div>
          
          {/* Animated floating lights */}
          <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-40 pointer-events-none">
            {[...Array(15)].map((_, i) => (
              <div
                key={`light-${i}`}
                className="w-3 h-3 rounded-full bg-yellow-300 twinkle-light"
                style={{
                  animationDelay: `${i * 0.3}s`,
                  left: `${(i * 6.67)}%`,
                }}
              />
            ))}
          </div>
          
          <div className="relative text-center">
            <h2 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg christmas-glow">
              🎄 🎅 NO FEE FREE TO RUN ALL THROUGH CHRISTMAS!!! 🎁 ⭐
            </h2>
            <p className="text-sm md:text-lg text-yellow-200 mt-1 font-semibold">
              Start mining now - completely free until January 1st!
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 w-full pt-24">
        <div className="text-center mb-8">
          {/* Hero image above title */}
          {backgroundImage && (
            <div className="mb-6 flex justify-center">
              <img
                src={backgroundImage}
                alt="Minr.online Logo"
                className="max-w-md max-h-48 w-auto h-auto object-contain mx-auto rounded-lg shadow-2xl"
                style={{
                  filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))',
                }}
                onError={() => setImageError(true)}
                onLoad={() => setImageError(false)}
              />
            </div>
          )}
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-2xl">
            {title}
          </h1>
          <p className="text-xl md:text-2xl text-gray-200 mb-2">
            {subtitle}
          </p>
          <p className="text-sm text-gray-300 mt-4">
            Join the lottery pool • <span className="line-through text-gray-500">$1 USD entry fee</span> <span className="text-green-400 font-bold">FREE UNTIL JAN 1ST!</span> • Split BTC rewards when blocks are found
          </p>
        </div>

        {/* Login Form */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl max-w-md mx-auto">
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Hidden username field for accessibility (email serves as username) */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={email}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
              style={{ display: 'none' }}
            />
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                placeholder="your@email.com"
              />
            </div>

            {usePassword && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={usePassword ? true : false}
                  autoComplete={usePassword ? "current-password" : "new-password"}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                  placeholder="Enter your password"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="usePassword"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/10 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="usePassword" className="text-sm text-gray-300 cursor-pointer">
                I have a password (login directly)
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl transform hover:scale-[1.02]"
            >
              {loading 
                ? (usePassword ? 'Logging in...' : 'Sending Magic Link...') 
                : (usePassword ? 'Login' : 'Send Magic Link')
              }
            </button>
          </form>

          {message && (
            <div className={`mt-6 p-4 rounded-xl backdrop-blur-sm transition-all duration-200 ${
              message.includes('Error') 
                ? 'bg-red-900/30 border border-red-500/50 text-red-200' 
                : 'bg-green-900/30 border border-green-500/50 text-green-200'
            }`}>
              <p className="text-sm font-medium">{message}</p>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-gray-400 text-center">
              New to Minr.online? Just enter your email to get started.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

