"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiCall } from '@/lib/api';
import Navbar from '@/components/Navbar';
import ProviderContentRow from '@/components/providers/ProviderContentRow';
import { useRouter } from 'next/navigation';
import { Play, Sparkles, ChevronRight, Info } from 'lucide-react';
import ProviderHero from '@/components/providers/ProviderHero';

interface ShowcaseItem {
    provider: {
        provider_id: number;
        provider_name: string;
        logo_path: string; // Full URL
        primary_color: string;
        secondary_color: string;
    };
    content: any[];
}

export default function ProvidersPage() {
    const [showcaseData, setShowcaseData] = useState<ShowcaseItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [collections, setCollections] = useState<any[]>([]);
    const router = useRouter();

    const fetchCollections = useCallback(async () => {
        try {
            const res = await apiCall('/api/collections');
            if (res) setCollections(res);
        } catch (err) {
            console.warn('Failed to fetch collections', err);
        }
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch showcase data
                const response = await apiCall('/api/providers/showcase');
                if (response && response.showcase) {
                    setShowcaseData(response.showcase);
                }
                // Fetch collections for My List functionality
                await fetchCollections();
            } catch (error) {
                console.error('Failed to fetch provider showcase:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [fetchCollections]);

    // Aggregate top content from ALL providers for the mixed hero
    const heroItems = React.useMemo(() => {
        if (showcaseData.length === 0) return [];

        const allContent: any[] = [];
        // Take top 2 items from each provider to mix
        showcaseData.forEach(p => {
            if (p.content && p.content.length > 0) {
                p.content.slice(0, 2).forEach(item => {
                    allContent.push({
                        ...item,
                        provider: {
                            name: p.provider.provider_name,
                            logo: p.provider.logo_path,
                            color: p.provider.primary_color
                        }
                    });
                });
            }
        });

        // Shuffle simply
        return allContent.sort(() => 0.5 - Math.random()).slice(0, 15);
    }, [showcaseData]);

    const handlePlay = (media: any) => {
        router.push(`/tmdb-movie/${media.id}?type=${media.media_type || media.type || 'movie'}`);
    };

    const handleInfo = (media: any) => {
        router.push(`/tmdb-movie/${media.id}?type=${media.media_type || media.type || 'movie'}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#141414] text-white overflow-x-hidden">
            <Navbar />

            {/* Main Hero Section (Global Mixed Showcase) */}
            {heroItems.length > 0 && (
                <ProviderHero
                    items={heroItems}
                    collections={collections}
                    onDataRefresh={fetchCollections}
                />
            )}

            <div className="relative z-10 pb-20 -mt-12">
                {showcaseData.map((item, index) => {
                    // Skip the first one if we used it for hero? 
                    // No, show it in the list too or maybe skip if redundant. 
                    // Let's show all but maybe with different styling.
                    // Actually listing all is consistent.

                    const brandColor = item.provider.primary_color || '#fff';

                    return (
                        <div key={item.provider.provider_id} className="mb-8 group/provider">
                            {/* Provider Header */}
                            <div
                                className="px-4 md:px-12 flex items-center justify-between mb-4 sticky top-[72px] z-30 py-4 transition-all duration-300 backdrop-blur-md bg-gradient-to-r from-[#141414] via-[#141414]/90 to-transparent border-b border-white/5"
                                style={{ borderLeft: `4px solid ${brandColor}` }}
                            >
                                <div className="flex items-center gap-4 cursor-pointer" onClick={() => router.push(`/providers/${item.provider.provider_id}`)}>
                                    <div className="relative w-10 h-10 md:w-12 md:h-12 bg-white/10 rounded-lg p-2 border border-white/10 overflow-hidden group-hover/provider:scale-110 transition-transform">
                                        <img
                                            src={item.provider.logo_path}
                                            alt={item.provider.provider_name}
                                            className="w-full h-full object-contain"
                                        />
                                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/provider:opacity-100 transition-opacity" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl md:text-3xl font-bold leading-none tracking-tight group-hover/provider:text-white/90 transition-colors">
                                            {item.provider.provider_name}
                                        </h2>
                                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1 flex items-center gap-1">
                                            Trending Content <ChevronRight className="w-3 h-3" />
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => router.push(`/providers/${item.provider.provider_id}`)}
                                    className="hidden md:flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:scale-105 active:scale-95 text-sm font-bold"
                                    style={{ color: brandColor }}
                                >
                                    Explore Full Library
                                </button>
                            </div>

                            {/* Content Grid/Scroll */}
                            <ProviderContentRow
                                title="" // Title handled by header above
                                media={item.content}
                                onPlay={handlePlay}
                                onInfo={handleInfo}
                                priority={index < 2}
                                accentColor={brandColor}
                                collections={collections}
                                onDataRefresh={fetchCollections}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
