import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { EnhancedAudioProvider } from "@/contexts/EnhancedAudioContext";
import { NavigationLoaderProvider } from "@/contexts/NavigationLoaderContext";
import NavigationLoader from "@/components/NavigationLoader";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HomeFlix",
  description: "Your personal Netflix-style streaming platform",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#dc2626" />
      </head>
      <body className={inter.className}>
        <NavigationLoaderProvider>
          <EnhancedAudioProvider>
            <NavigationLoader />
            {children}
          </EnhancedAudioProvider>
        </NavigationLoaderProvider>
      </body>
    </html>
  );
}
