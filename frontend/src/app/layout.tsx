import type { Metadata } from "next";
import "./globals.css";
import { EnhancedAudioProvider } from "@/contexts/EnhancedAudioContext";
import { NavigationLoaderProvider } from "@/contexts/NavigationLoaderContext";
import { MusicPlayerProvider } from "@/contexts/MusicPlayerContext";
import { DialogProvider } from "@/components/providers/DialogProvider";
import NavigationLoader from "@/components/NavigationLoader";
import SWRProvider from "@/components/providers/SWRProvider";
import WidgetPreloader from "@/components/WidgetPreloader";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: {
    template: "%s | HomeFlix",
    default: "HomeFlix - Your Personal Streaming Platform"
  },
  description: "Your personal Netflix-style streaming platform",
  keywords: ["streaming", "movies", "tv shows", "entertainment", "homeflix"],
  authors: [{ name: "HomeFlix Team" }],
  creator: "HomeFlix",
  publisher: "HomeFlix",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/icon-32x32.png', type: 'image/png', sizes: '32x32' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
  },
  manifest: '/site.webmanifest',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#dc2626',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* DNS prefetch for external resources */}
        <link rel="dns-prefetch" href="//image.tmdb.org" />
        <link rel="preconnect" href="//image.tmdb.org" crossOrigin="anonymous" />
        {/* Self-hosted Inter font preloaded - no external URL */}
        <link rel="preload" href="/fonts/Inter/InterVariable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />

        {/* Performance hints */}
        <meta name="color-scheme" content="dark" />

        {/* Prevent FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'dark';
                  document.documentElement.classList.add(theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-black text-white antialiased font-sans" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <DialogProvider>
          <SWRProvider>
            <NavigationLoaderProvider>
              <EnhancedAudioProvider>
                <MusicPlayerProvider>
                  <Suspense fallback={<div className="min-h-screen bg-black" />}>
                    <WidgetPreloader />
                    <NavigationLoader />
                    {children}
                  </Suspense>
                </MusicPlayerProvider>
              </EnhancedAudioProvider>
            </NavigationLoaderProvider>
          </SWRProvider>
        </DialogProvider>
      </body>
    </html>
  );
}
