import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getGoogleFontsUrl } from '@/lib/fontStyles';
import { EnhancedAudioProvider } from "@/contexts/EnhancedAudioContext";
import { RecommendationProvider } from "@/contexts/RecommendationContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HomeFlix",
  description: "Your personal Netflix-style streaming platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link href={getGoogleFontsUrl()} rel="stylesheet" />
      </head>
      <body className={inter.className}>
        <EnhancedAudioProvider>
          <RecommendationProvider>
            {children}
          </RecommendationProvider>
        </EnhancedAudioProvider>
      </body>
    </html>
  );
}
