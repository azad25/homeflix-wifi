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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
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
