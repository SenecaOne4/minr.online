import type { Metadata } from 'next'
import './globals.css'
import FaviconLinks from '@/components/FaviconLinks'

// Default OG image URL - will be overridden by SiteMeta component if custom image is set
const DEFAULT_OG_IMAGE = process.env.NEXT_PUBLIC_SITE_URL 
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/og-default.png`
  : 'https://minr.online/og-default.png';

export const metadata: Metadata = {
  title: 'Minr.online - Bitcoin Lottery Pool Mining Platform',
  description: 'Join the Minr.online lottery pool. Like a lottery - if someone solves a block, we split the BTC payout. $1 USD entry fee required.',
  openGraph: {
    title: 'Minr.online - Bitcoin Lottery Pool Mining Platform',
    description: 'Join the Minr.online lottery pool. Like a lottery - if someone solves a block, we split the BTC payout.',
    type: 'website',
    siteName: 'Minr.online',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://minr.online',
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Minr.online - Bitcoin Lottery Pool Mining Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Minr.online - Bitcoin Lottery Pool Mining Platform',
    description: 'Join the Minr.online lottery pool. Like a lottery - if someone solves a block, we split the BTC payout.',
    images: [DEFAULT_OG_IMAGE],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Minr.online',
  },
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

