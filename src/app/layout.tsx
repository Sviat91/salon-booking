import '../styles/globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import Providers from './providers'

const inter = Inter({ subsets: ['latin'] })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://somique.beauty'
const metadataTitle = 'Somique Beauty'
const metadataDescription = 'Zarezerwuj wizytę w Somique Beauty. Szybka i wygodna rezerwacja online.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: metadataTitle,
  description: metadataDescription,
  keywords: ['masaż twarzy', 'beauty', 'kosmetologia', 'rezerwacja online', 'somique beauty', 'spa', 'relaks'],
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'Somique Beauty',
    url: '/',
    title: metadataTitle,
    description: metadataDescription,
    locale: 'pl_PL',
    images: [
      {
        url: '/prev.png',
        width: 1200,
        height: 630,
        alt: 'Somique Beauty',
        type: 'image/png',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: metadataTitle,
    description: metadataDescription,
    images: [
      {
        url: '/prev.png',
        alt: 'Somique Beauty',
      }
    ],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
