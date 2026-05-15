import type { Metadata, Viewport } from 'next'
import { AppProvider } from '@/components/providers/app-provider'
import { ToastProvider } from '@/components/providers/toast-provider'
import { PwaRegister } from '@/components/pwa-register'

import './globals.css'

export const metadata: Metadata = {
  title: 'Pink Day',
  description: 'Prywatna, słodka aplikacja do zadań, punktów i nagród dla dwóch osób.',
  applicationName: 'Pink Day',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Pink Day',
  },
}

export const viewport: Viewport = {
  themeColor: '#ff8eb4',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body className="antialiased">
        <AppProvider>
          <ToastProvider>
            <PwaRegister />
            {children}
          </ToastProvider>
        </AppProvider>
      </body>
    </html>
  )
}
