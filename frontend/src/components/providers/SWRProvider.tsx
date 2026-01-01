"use client";

import { SWRConfig } from 'swr';
import { swrConfig } from '@/lib/swr-api';
import { useEffect } from 'react';
import { preloadEssentialData } from '@/lib/cacheService';

interface SWRProviderProps {
  children: React.ReactNode;
}

export default function SWRProvider({ children }: SWRProviderProps) {
  // Preload essential data on app start
  useEffect(() => {
    // Use requestIdleCallback for non-blocking preload
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          preloadEssentialData();
        });
      } else {
        setTimeout(() => {
          preloadEssentialData();
        }, 100);
      }
    }
  }, []);

  return (
    <SWRConfig value={swrConfig}>
      {children}
    </SWRConfig>
  );
}