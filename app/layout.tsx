import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Lumin AI CRM', template: '%s | Lumin AI CRM' },
  description: 'CRM inteligente Lumin AI para equipas comerciais',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Lumin AI CRM' },
  icons: { icon: '/icons/lumin-ai.svg' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#D4AF37',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={inter.variable} style={{ background: '#F8FAFC' }}>
      <head>
        <link rel="icon" type="image/svg+xml" href="/icons/lumin-ai.svg" />
      </head>
      <body>{children}</body>
    </html>
  )
}
