import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}

