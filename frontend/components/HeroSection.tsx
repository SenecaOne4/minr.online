'use client';

import Link from 'next/link';

interface SiteSettings {
  hero_title?: string;
  hero_subtitle?: string;
  hero_image_url?: string;
}

interface HeroSectionProps {
  settings?: SiteSettings;
}

export default function HeroSection({ settings }: HeroSectionProps) {
  const title = settings?.hero_title || 'Minr.online';
  const subtitle = settings?.hero_subtitle || 'Bitcoin Lottery Pool Mining Platform';
  const backgroundImage = settings?.hero_image_url;

  return (
    <div
      className="relative min-h-[500px] flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
      style={
        backgroundImage
          ? {
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {backgroundImage && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      )}
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
          {title}
        </h1>
        <p className="text-xl md:text-2xl text-gray-300 mb-8">
          {subtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-200 shadow-xl hover:shadow-2xl"
          >
            Get Started
          </Link>
          <Link
            href="/miner"
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-200 shadow-xl hover:shadow-2xl"
          >
            Start Mining
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-6">
          Join the lottery pool • $1 USD entry fee • Split BTC rewards when blocks are found
        </p>
      </div>
    </div>
  );
}

