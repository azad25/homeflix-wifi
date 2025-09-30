import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { EnhancedAudioProvider } from "@/contexts/EnhancedAudioContext";

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
        <EnhancedAudioProvider>
          {children}
        </EnhancedAudioProvider>
      </body>
    </html>
  );
}
