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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-gray-900 text-white antialiased" style={{ backgroundColor: '#111827', margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}

