import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SD Dialer - CRM de Gestão Comercial',
  description: 'Plataforma profissional de CRM para gestão comercial e distribuição de leads',
  keywords: ['CRM', 'vendas', 'leads', 'gestão comercial', 'Portugal'],
  authors: [{ name: 'SD Dialer Team' }],
  creator: 'SD Dialer',
  publisher: 'SD Dialer',
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    url: 'https://sddialer.com',
    title: 'SD Dialer - CRM de Gestão Comercial',
    description: 'Plataforma profissional de CRM para gestão comercial e distribuição de leads',
    images: [
      {
        url: '/icons/icon-512.png',
        width: 512,
        height: 512,
        alt: 'SD Dialer',
      },
    ],
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/apple-touch-icon.png',
    shortcut: '/icons/icon-192.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SD Dialer',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SD Dialer" />
        <meta name="application-name" content="SD Dialer" />
        <meta name="msapplication-TileColor" content="#0066cc" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
      </head>
      <body className="antialiased bg-white text-gray-900">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
