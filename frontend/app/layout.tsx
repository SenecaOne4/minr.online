import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Minr.online - Bitcoin Mining Platform',
  description: 'Bitcoin inverse-lottery mining platform',
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

