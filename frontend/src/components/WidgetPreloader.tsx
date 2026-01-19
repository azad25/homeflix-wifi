"use client";

import { useEffect } from 'react';
import { getApiUrl } from '@/lib/api';
import { widgetCache } from '@/utils/widgetCache';

/**
 * WidgetPreloader - Ultra-aggressive prefetching for instant widget rendering
 * Preloads and caches widget data before user navigation for sub-second loading
 */
export default function WidgetPreloader() {
    useEffect(() => {
        // Ultra-aggressive prefetch for instant loading
        const prefetchWidgets = async () => {
            const apiUrl = getApiUrl();
            const pages = ['home', 'movies', 'tv-shows', 'browse', 'new-popular'];

            // Use requestIdleCallback for non-blocking prefetch
            const doPrefetch = async () => {
                for (const page of pages) {
                    // Check if already cached
                    if (widgetCache.get(page)) {
                        continue;
                    }

                    try {
                        const response = await fetch(`${apiUrl}/api/widgets/page/${page}/with-data`, {
                            headers: {
                                'Content-Type': 'application/json',
                                'X-User-ID': '1',
                            },
                            priority: 'low' as RequestPriority,
                        });

                        if (response.ok) {
                            const data = await response.json();
                            widgetCache.set(page, data);
                            console.log(`🚀 Preloaded widgets for ${page}`);
                        }
                    } catch (error) {
                        // Silently ignore prefetch errors
                        console.warn(`Failed to prefetch widgets for ${page}:`, error);
                    }

                    // Small delay between requests to avoid overwhelming server
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            };

            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(doPrefetch, { timeout: 5000 });
            } else {
                // Fallback: delay slightly to not block initial render
                setTimeout(doPrefetch, 1000);
            }
        };

        prefetchWidgets();
    }, []);

    // Render nothing - this is a background utility component
    return null;
}
