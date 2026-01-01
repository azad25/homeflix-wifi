"use client";

import React, { useEffect, useState } from 'react';

interface TestWidgetRendererProps {
    page: string;
}

export default function TestWidgetRenderer({ page }: TestWidgetRendererProps) {
    const [widgets, setWidgets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchWidgets = async () => {
            try {
                console.log('TestWidgetRenderer: Fetching widgets for page:', page);
                const response = await fetch(`http://localhost:8252/api/widgets/page/${page}/with-data`);
                console.log('TestWidgetRenderer: Response status:', response.status);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('TestWidgetRenderer: Received data:', data.length, 'widgets');
                setWidgets(data);
            } catch (err) {
                console.error('TestWidgetRenderer: Error fetching widgets:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchWidgets();
    }, [page]);

    if (loading) {
        return (
            <div className="w-full p-8 text-center">
                <div className="text-white">Loading widgets...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full p-8 text-center">
                <div className="text-red-400">Error: {error}</div>
            </div>
        );
    }

    return (
        <div className="w-full p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Test Widget Renderer</h2>
            <div className="text-white mb-4">Found {widgets.length} widgets for page: {page}</div>
            
            {widgets.map((widget, index) => (
                <div key={widget.id} className="mb-4 p-4 bg-gray-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-white">{widget.name}</h3>
                    <div className="text-gray-300 text-sm">
                        Type: {widget.type} | Layout: {widget.layout} | Data: {widget.data?.length || 0} items
                    </div>
                    {widget.data && widget.data.length > 0 && (
                        <div className="mt-2 text-gray-400 text-xs">
                            First item: {widget.data[0]?.title}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}