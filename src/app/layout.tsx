import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { APP_NAME } from '@/lib/brand'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'CRM para agências de turismo',
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'default' },
  icons: { apple: '/icones/180' },
}

export const viewport: Viewport = {
  themeColor: '#1d4ed8',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
