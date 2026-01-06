import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HomeFlix Setup - Installation Wizard',
  description: 'Complete setup and installation wizard for HomeFlix streaming platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}