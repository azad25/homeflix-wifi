"use client";

import React, { useState, useEffect } from 'react';
import { getApiUrl } from '@/lib/api';

interface WidgetDebugProps {
    className?: string;
}

export default function WidgetDebug({ className = '' }: WidgetDebugProps) {
    const [tmdbData, setTmdbData] = useState<any>(null);
    const [widgetData, setWidgetData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const apiUrl = getApiUrl();

    useEffect(() => {
        const testAPIs = async () => {
            try {
                console.log('Testing APIs with base URL:', apiUrl);
                
                // Test TMDB popular movies
                console.log('Testing TMDB endpoint...');
                const tmdbResponse = await fetch(`${apiUrl}/api/tmdb/movie/popular`);
                console.log('TMDB Response status:', tmdbResponse.status);
                if (tmdbResponse.ok) {
                    const tmdbResult = await tmdbResponse.json();
                    setTmdbData(tmdbResult);
                    console.log('TMDB Popular Movies:', tmdbResult);
                } else {
                    console.error('TMDB API failed:', tmdbResponse.status, tmdbResponse.statusText);
                }

                // Test widgets for home page
                console.log('Testing widgets endpoint...');
                const widgetResponse = await fetch(`${apiUrl}/api/widgets/page/home`);
                console.log('Widget Response status:', widgetResponse.status);
                if (widgetResponse.ok) {
                    const widgetResult = await widgetResponse.json();
                    setWidgetData(widgetResult);
                    console.log('Home Widgets:', widgetResult);
                } else {
                    console.error('Widget API failed:', widgetResponse.status, widgetResponse.statusText);
                }
            } catch (error) {
                console.error('Debug API test failed:', error);
            } finally {
                setLoading(false);
            }
        };

        testAPIs();
    }, [apiUrl]);

    if (loading) {
        return <div className={`p-4 bg-blue-900/20 rounded-lg ${className}`}>Loading debug info...</div>;
    }

    return (
        <div className={`p-4 bg-blue-900/20 rounded-lg text-white text-sm ${className}`}>
            <h3 className="font-bold mb-2">Widget Debug Info</h3>
            
            <div className="mb-4">
                <h4 className="font-semibold">TMDB Popular Movies:</h4>
                <p>Status: {tmdbData ? 'Success' : 'Failed'}</p>
                {tmdbData && (
                    <p>Count: {tmdbData.results?.length || 0} movies</p>
                )}
            </div>

            <div className="mb-4">
                <h4 className="font-semibold">Home Page Widgets:</h4>
                <p>Count: {widgetData?.length || 0} widgets</p>
                {widgetData && widgetData.map((w: any) => (
                    <div key={w.id} className="ml-2 text-xs">
                        • {w.name} ({w.type}) - {w.data_source} - {w.layout}
                    </div>
                ))}
            </div>
        </div>
    );
}