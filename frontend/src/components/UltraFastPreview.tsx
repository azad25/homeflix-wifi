"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getApiUrl } from '@/lib/api';
import { Media } from '@/types/media';

interface UltraFastPreviewProps {
    media: Media;
    autoPlay?: boolean;
    muted?: boolean;
    loop?: boolean;
    className?: string;
    onLoadStart?: () => void;
    onCanPlay?: () => void;
    onError?: (error: any) => void;
    quality?: 'low' | 'medium' | 'high' | 'auto';
    delay?: number; // Delay before starting preview
}

const UltraFastPreview: React.FC<UltraFastPreviewProps> = ({
    media,
    autoPlay = true,
    muted = true,
    loop = true,
    className = '',
    onLoadStart,
    onCanPlay,
    onError,
    quality = 'auto',
    delay = 0
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [deviceType, setDeviceType] = useState<string>('desktop');
    const [networkSpeed, setNetworkSpeed] = useState<string>('unknown');

    // Ultra-fast device and network detection
    useEffect(() => {
        const detectCapabilities = () => {
            const userAgent = navigator.userAgent.toLowerCase();
            
            // Enhanced device detection
            if (userAgent.includes('mobile') || userAgent.includes('android')) {
                setDeviceType('mobile');
            } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
                setDeviceType('ios');
            } else if (userAgent.includes('mac')) {
                setDeviceType('mac');
            } else if (userAgent.includes('windows')) {
                setDeviceType('windows');
            } else if (userAgent.includes('linux')) {
                setDeviceType('linux');
            }

            // Network speed detection
            if ('connection' in navigator) {
                const connection = (navigator as any).connection;
                if (connection) {
                    const effectiveType = connection.effectiveType;
                    setNetworkSpeed(effectiveType || 'unknown');
                }
            }
        };

        detectCapabilities();
    }, []);

    // Get ultra-optimized preview URL
    const getPreviewUrl = useCallback(() => {
        const baseUrl = getApiUrl();
        const url = `${baseUrl}/api/preview-clips/${media.id}`;

        const params = new URLSearchParams();

        // Ultra-fast preview optimization
        params.set('optimize', 'instant-preview');
        params.set('buffer', 'minimal');
        params.set('latency', 'zero');
        params.set('preload', 'aggressive');

        // Local network detection for ultra-high quality
        const isLocalNetwork = window.location.hostname === 'localhost' || 
                              window.location.hostname.startsWith('192.168.') ||
                              window.location.hostname.startsWith('10.') ||
                              window.location.hostname.startsWith('172.');

        // Quality optimization
        if (quality === 'auto') {
            if (isLocalNetwork) {
                params.set('quality', deviceType === 'mobile' ? 'medium' : 'high');
            } else {
                params.set('quality', deviceType === 'mobile' ? 'low' : 'medium');
            }
        } else {
            params.set('quality', quality);
        }

        // Format optimization for instant loading
        if (deviceType === 'ios' || deviceType === 'mac') {
            params.set('format', 'mp4');
        } else {
            params.set('format', 'mp4'); // MP4 for maximum compatibility in previews
        }

        // Device-specific optimizations
        params.set('device', deviceType);
        params.set('preview-mode', 'ultra-fast');

        return `${url}?${params.toString()}`;
    }, [media.id, quality, deviceType]);

    // Ultra-fast video initialization
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Ultra-fast loading optimizations
        video.preload = 'metadata';
        video.crossOrigin = 'anonymous';
        video.playsInline = true;

        // Hardware acceleration hints
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('x-webkit-airplay', 'allow');

        // Event handlers for instant loading
        const handleLoadStart = () => {
            setIsLoading(true);
            setHasError(false);
            onLoadStart?.();
        };

        const handleCanPlay = () => {
            setIsLoading(false);
            setIsReady(true);
            onCanPlay?.();

            // Auto-play with delay if specified
            if (autoPlay) {
                if (delay > 0) {
                    setTimeout(() => {
                        video.play().catch(console.error);
                    }, delay);
                } else {
                    video.play().catch(console.error);
                }
            }
        };

        const handleError = (e: Event) => {
            setIsLoading(false);
            setHasError(true);
            onError?.(e);

            // Try fallback with lower quality
            const currentSrc = video.src;
            if (!currentSrc.includes('quality=low')) {
                const fallbackUrl = getPreviewUrl().replace(/quality=[^&]*/, 'quality=low');
                video.src = fallbackUrl;
                video.load();
            }
        };

        const handleLoadedMetadata = () => {
            // Optimize video settings based on metadata
            if (video.videoWidth && video.videoHeight) {
                const aspectRatio = video.videoWidth / video.videoHeight;
                video.setAttribute('data-aspect-ratio', aspectRatio.toString());
            }
        };

        // Add event listeners
        video.addEventListener('loadstart', handleLoadStart);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('error', handleError);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);

        return () => {
            video.removeEventListener('loadstart', handleLoadStart);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('error', handleError);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        };
    }, [autoPlay, delay, getPreviewUrl, onCanPlay, onError, onLoadStart]);

    // Render ultra-fast preview sources
    const renderPreviewSources = () => {
        const baseUrl = getPreviewUrl();

        return (
            <>
                {/* Primary ultra-fast source */}
                <source
                    src={baseUrl}
                    type="video/mp4; codecs=&quot;avc1.42E01E, mp4a.40.2&quot;"
                />

                {/* Medium quality fallback */}
                <source
                    src={`${baseUrl}&quality=medium`}
                    type="video/mp4"
                />

                {/* Low quality emergency fallback */}
                <source
                    src={`${baseUrl}&quality=low`}
                    type="video/mp4"
                />
            </>
        );
    };

    return (
        <div className={`relative ${className}`}>
            <video
                ref={videoRef}
                autoPlay={false} // We handle autoplay manually for better control
                muted={muted}
                loop={loop}
                playsInline
                className="w-full h-full object-cover"
                style={{
                    backgroundColor: 'transparent',
                    // Hardware acceleration hints
                    transform: 'translateZ(0)',
                    willChange: 'transform',
                }}
            >
                {renderPreviewSources()}
            </video>

            {/* Ultra-minimal loading indicator */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {/* Error state */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="text-white text-xs text-center">
                        <div className="mb-1">⚠️</div>
                        <div>Preview unavailable</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UltraFastPreview;