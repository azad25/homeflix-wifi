"use client";

import { useEffect } from 'react';
import { getApiUrl } from '@/lib/api';

/**
 * WidgetPreloader - Prefetches widget data on app load for instant widget rendering
 * This component makes a background request to warm the widget cache before user
 * navigates to pages with widgets.
 */
export default function WidgetPreloader() {
    useEffect(() => {
        // Prefetch home page widgets in background
        const prefetchWidgets = async () => {
            const apiUrl = getApiUrl();
            const pages = ['home', 'movies', 'tv-shows'];

            // Use requestIdleCallback for non-blocking prefetch
            const doPrefetch = () => {
                pages.forEach(page => {
                    fetch(`${apiUrl}/api/widgets/page/${page}/with-data`, {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-User-ID': '1',
                        },
                        priority: 'low' as RequestPriority,
                    }).catch(() => {
                        // Silently ignore prefetch errors
                    });
                });
            };

            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(doPrefetch, { timeout: 2000 });
            } else {
                // Fallback: delay slightly to not block initial render
                setTimeout(doPrefetch, 500);
            }
        };

        prefetchWidgets();
    }, []);

    // Render nothing - this is a background utility component
    return null;
}
