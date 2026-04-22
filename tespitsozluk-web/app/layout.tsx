import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { ThemeProvider } from '@/components/theme-provider'
import { WelcomeModal } from '@/components/welcome-modal'
import { Toaster } from '@/components/ui/sonner'
import { getSiteUrl } from '@/lib/api'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: 'Tespit Sözlük',
  description: 'Modern sözlük platformu — başlıkları keşfet, entry yaz, topluluğa katıl.',
  applicationName: 'Tespit Sözlük',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: 'Tespit Sözlük',
    title: 'Tespit Sözlük',
    description: 'Modern sözlük platformu — başlıkları keşfet, entry yaz, topluluğa katıl.',
    url: '/',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Tespit Sözlük',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tespit Sözlük',
    description: 'Modern sözlük platformu — başlıkları keşfet, entry yaz, topluluğa katıl.',
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1c1d' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="tr" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Analytics />
          <WelcomeModal />
        </ThemeProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
