import { Media } from "@/types/media";

export interface WidgetWithData {
    id: number;
    name: string;
    type: string;
    page: string;
    position: number;
    enabled: boolean;
    config: string;
    content_type: string;
    data_source: string;
    max_items: number;
    layout: string;
    color_scheme: string;
    data: any[]; // Using any[] to support MediaItem and backend variations
}

interface CacheEntry {
    data: WidgetWithData[];
    timestamp: number;
}

class WidgetCacheManager {
    private cache = new Map<string, CacheEntry>();
    private CACHE_TTL = 2 * 60 * 1000; // 2 minutes
    private STORAGE_KEY = 'homeflix-widget-cache';

    constructor() {
        if (typeof window !== 'undefined') {
            this.preloadFromStorage();
        }
    }

    private preloadFromStorage() {
        try {
            const stored = sessionStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                Object.entries(parsed).forEach(([key, value]: [string, any]) => {
                    if (value && Date.now() - value.timestamp < this.CACHE_TTL) {
                        this.cache.set(key, value);
                    }
                });
            }
        } catch (e) {
            console.warn('Failed to preload widget cache', e);
        }
    }

    private persistToStorage() {
        if (typeof window === 'undefined') return;
        try {
            const cacheObj: Record<string, any> = {};
            this.cache.forEach((value, key) => {
                cacheObj[key] = value;
            });
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheObj));
        } catch (e) {
            console.warn('Failed to persist widget cache', e);
        }
    }

    get(page: string): WidgetWithData[] | null {
        const key = `widgets-${page}`;
        const cached = this.cache.get(key);

        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }
        return null;
    }

    set(page: string, data: WidgetWithData[]) {
        const key = `widgets-${page}`;
        // Filter out notification widgets from cache since they need fresh data
        const cacheableData = data.map(widget => {
            if (widget.type === 'notifications') {
                // Cache the widget config but not the data
                return { ...widget, data: [] };
            }
            return widget;
        });
        this.cache.set(key, { data: cacheableData, timestamp: Date.now() });
        this.persistToStorage();
    }

    invalidate(page: string) {
        const key = `widgets-${page}`;
        this.cache.delete(key);
        this.persistToStorage();
        console.log(`[WidgetCache] Invalidated cache for ${page}`);
    }

    invalidateAll() {
        this.cache.clear();
        this.persistToStorage();
        console.log('[WidgetCache] Invalidated all cache');
    }
}

export const widgetCache = new WidgetCacheManager();
