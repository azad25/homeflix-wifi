"use client";

import { SWRConfig } from 'swr';
import { swrConfig } from '@/lib/swr-api';
import { useEffect } from 'react';
import { preloadEssentialData } from '@/lib/cacheService';
import { preloadEssentialWidgets } from '@/utils/widgetCache';
import { loadYouTubeAPI } from '@/lib/youtube';

interface SWRProviderProps {
  children: React.ReactNode;
}

export default function SWRProvider({ children }: SWRProviderProps) {
  // Preload essential data on app start for instant loading
  useEffect(() => {
    // Use requestIdleCallback for non-blocking preload
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          // Preload general data
          preloadEssentialData();
          // Preload widget data
          preloadEssentialWidgets();
          // Warm the YouTube player API so the first trailer starts fast.
          loadYouTubeAPI().catch(() => undefined);
        });
      } else {
        setTimeout(() => {
          preloadEssentialData();
          preloadEssentialWidgets();
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