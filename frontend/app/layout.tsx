import type { Metadata } from 'next'
import './globals.css'
import FaviconLinks from '@/components/FaviconLinks'

// Default OG image URL - fallback if no custom image is set
const DEFAULT_OG_IMAGE = process.env.NEXT_PUBLIC_SITE_URL 
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/og-default.png`
  : 'https://minr.online/og-default.png';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://minr.online';

// Fetch site settings server-side for OG image
async function getSiteSettings() {
  try {
    // Fetch from backend API (using internal URL if available, otherwise public URL)
    const apiUrl = process.env.INTERNAL_API_URL || SITE_URL;
    const response = await fetch(`${apiUrl}/api/admin/settings/public`, {
      next: { revalidate: 60 }, // Revalidate every 60 seconds
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const settings = await response.json();
      return settings;
    }
  } catch (error) {
    console.error('[layout] Error fetching site settings:', error);
  }
  return null;
}

// Generate metadata dynamically with server-side data
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  
  // Determine OG image URL with fallback chain
  let ogImageUrl = DEFAULT_OG_IMAGE;
  let ogImageWidth = 1200;
  let ogImageHeight = 630;
  
  if (settings?.og_image_url) {
    ogImageUrl = settings.og_image_url;
  } else if (settings?.logo_url) {
    ogImageUrl = settings.logo_url;
  } else if (settings?.favicon_url) {
    ogImageUrl = settings.favicon_url;
    ogImageWidth = 512;
    ogImageHeight = 512;
  }

  const title = settings?.hero_title || 'Minr.online - Bitcoin Lottery Pool Mining Platform';
  const description = settings?.hero_subtitle || 'Join the Minr.online lottery pool. Like a lottery - if someone solves a block, we split the BTC payout. $1 USD entry fee required.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Minr.online',
      url: SITE_URL,
      images: [
        {
          url: ogImageUrl,
          width: ogImageWidth,
          height: ogImageHeight,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'Minr.online',
    },
    other: {
      'mobile-web-app-capable': 'yes',
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <FaviconLinks />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>{children}</body>
    </html>
  )
}

