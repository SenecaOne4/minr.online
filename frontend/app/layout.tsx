import type { Metadata } from 'next'
import './globals.css'
import FaviconLinks from '@/components/FaviconLinks'

export const metadata: Metadata = {
  title: 'Minr.online - Bitcoin Lottery Pool Mining Platform',
  description: 'Join the Minr.online lottery pool. Like a lottery - if someone solves a block, we split the BTC payout. $1 USD entry fee required.',
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

