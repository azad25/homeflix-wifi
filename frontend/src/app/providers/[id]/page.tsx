"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { API_ENDPOINTS, apiCall } from '@/lib/api';
import ProviderHero from '@/components/providers/ProviderHero';
import ProviderContentRow from '@/components/providers/ProviderContentRow';
import Navbar from '@/components/Navbar';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface ProviderData {
    provider: {
        id: number;
        name: string;
        logo_url: string;
        primary_color: string;
        secondary_color: string;
    };
    movies: any[];
    tv_shows: any[];
    trending?: any[];
    popular?: any[];
    new_releases?: any[];
    regions: string[];
}

export default function ProviderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [data, setData] = useState<ProviderData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'movies' | 'tv'>('all');
    const [collections, setCollections] = useState<any[]>([]);

    const fetchCollections = useCallback(async () => {
        try {
            const res = await apiCall('/api/collections');
            if (res) {
                setCollections(res);
            }
        } catch (err) {
            console.warn('Failed to fetch collections', err);
        }
    }, []);

    const fetchProviderData = useCallback(async () => {
        try {
            const providerId = params?.id;
            if (!providerId) return;

            // Don't set loading true on refresh to avoid flickering, only on initial load
            // We check local loading state instead of data dependency
            setLoading(prev => {
                if (!prev && !data) return true;
                return prev;
            });

            // Fetch main content
            const response = await apiCall(`/api/providers/${providerId}/content`);
            if (response) {
                // Set initial data
                setData(prev => ({
                    ...response,
                    // Preserve existing secondary data if we're just refreshing main content (though usually we fetch all)
                    trending: prev?.trending || [],
                    popular: prev?.popular || [],
                    new_releases: prev?.new_releases || []
                }));

                // Fetch additional carousels in background
                try {
                    const [trending, popular, newReleases] = await Promise.all([
                        apiCall(`/api/providers/${providerId}/trending`),
                        apiCall(`/api/providers/${providerId}/popular`),
                        apiCall(`/api/providers/${providerId}/new`)
                    ]);

                    setData(prev => prev ? {
                        ...prev,
                        trending: trending?.results || [],
                        popular: popular?.results || [],
                        new_releases: newReleases?.results || []
                    } : null);
                } catch (secondaryErr) {
                    console.warn('Failed to fetch secondary provider data', secondaryErr);
                }
            }
        } catch (err) {
            console.error('Failed to fetch provider data:', err);
            setError('Failed to load provider content');
        } finally {
            setLoading(false);
        }
    }, [params?.id]); // Removed 'data' from dependency array to prevent infinite loop

    useEffect(() => {
        if (params?.id) {
            fetchProviderData();
            fetchCollections();
        }
    }, [params?.id, fetchProviderData, fetchCollections]);

    const handlePlay = (media: any) => {
        // Navigate to TMDB detail page
        router.push(`/tmdb-movie/${media.id}?type=${media.media_type || media.type || 'movie'}`);
    };

    const handleInfo = (media: any) => {
        // Navigate to TMDB detail page
        router.push(`/tmdb-movie/${media.id}?type=${media.media_type || media.type || 'movie'}`);
    };

    const handleDataRefresh = () => {
        fetchCollections();
        // Optionally refresh provider data if needed, but MyList actions don't change provider content usually
    };

    // Build hero items from initial movies/tv_shows to prevent layout shift/glitch when secondary data loads
    // We prioritize movies but mix in TV shows if available
    const heroItems = React.useMemo(() => {
        if (!data) return [];
        const { movies, tv_shows } = data;
        return [...(movies || []), ...(tv_shows || [])].slice(0, 8);
    }, [data]);

    if (loading && !data) {
        return (
            <div className="min-h-screen bg-[#141414] flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-[#141414] flex items-center justify-center text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Provider Not Found</h1>
                    <button
                        onClick={() => router.push('/providers')}
                        className="bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-gray-200"
                    >
                        Back to Providers
                    </button>
                </div>
            </div>
        );
    }

    const { provider, movies, tv_shows, trending, popular, new_releases } = data;
    const brandColor = provider.primary_color || '#ffffff';

    return (
        <div className="min-h-screen bg-[#141414] text-white">
            {/* Navbar */}
            <Navbar />

            {/* Back Button Overlay */}
            <div className="absolute top-24 left-4 md:left-12 z-50">
                <button
                    onClick={() => router.push('/providers')}
                    className="flex items-center gap-2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 transition-all group"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="font-medium text-sm">Back to Providers</span>
                </button>
            </div>

            {/* Hero Section */}
            <ProviderHero
                providerName={provider.name}
                providerLogo={provider.logo_url}
                brandColor={brandColor}
                items={heroItems}
                collections={collections}
                onDataRefresh={handleDataRefresh}
            />

            <div className="relative z-20 pt-8 pb-12 space-y-8">

                {/* Filter Tabs */}
                <div className="flex justify-center mb-8 sticky top-20 z-40">
                    <div className="bg-black/80 backdrop-blur-md p-1 rounded-full border border-white/10 flex gap-2">
                        {['all', 'movies', 'tv'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-6 py-2 rounded-full font-medium transition-all ${activeTab === tab
                                    ? 'bg-white text-black shadow-lg scale-105'
                                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                                    }`}
                                style={activeTab === tab ? { backgroundColor: brandColor, color: '#fff' } : {}}
                            >
                                {tab === 'all' ? 'All Content' : tab === 'tv' ? 'TV Shows' : 'Movies'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Rows */}
                {(activeTab === 'all' || activeTab === 'movies') && new_releases && new_releases.length > 0 && (
                    <ProviderContentRow
                        title="New Releases"
                        media={new_releases}
                        onPlay={handlePlay}
                        onInfo={handleInfo}
                        priority={true}
                        accentColor={brandColor}
                        collections={collections}
                        onDataRefresh={handleDataRefresh}
                    />
                )}

                {(activeTab === 'all' || activeTab === 'movies' || activeTab === 'tv') && trending && trending.length > 0 && (
                    <ProviderContentRow
                        title={`Trending on ${provider.name}`}
                        media={trending}
                        onPlay={handlePlay}
                        onInfo={handleInfo}
                        accentColor={brandColor}
                        collections={collections}
                        onDataRefresh={handleDataRefresh}
                    />
                )}

                {(activeTab === 'all' || activeTab === 'movies') && movies.length > 0 && (
                    <ProviderContentRow
                        title="Popular Movies"
                        media={movies}
                        onPlay={handlePlay}
                        onInfo={handleInfo}
                        accentColor={brandColor}
                        collections={collections}
                        onDataRefresh={handleDataRefresh}
                    />
                )}

                {(activeTab === 'all' || activeTab === 'tv') && tv_shows.length > 0 && (
                    <ProviderContentRow
                        title="TV Shows"
                        media={tv_shows}
                        onPlay={handlePlay}
                        onInfo={handleInfo}
                        accentColor={brandColor}
                        collections={collections}
                        onDataRefresh={handleDataRefresh}
                    />
                )}
            </div>
        </div>
    );
}
