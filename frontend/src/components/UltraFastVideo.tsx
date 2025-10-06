"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getApiUrl } from '@/lib/api';
import { Media } from '@/types/media';

interface UltraFastVideoProps {
    media: Media;
    autoPlay?: boolean;
    muted?: boolean;
    loop?: boolean;
    controls?: boolean;
    className?: string;
    onLoadStart?: () => void;
    onCanPlay?: () => void;
    onError?: (error: any) => void;
    quality?: 'low' | 'medium' | 'high' | '4k' | 'auto';
    preload?: 'none' | 'metadata' | 'auto';
}

const UltraFastVideo: React.FC<UltraFastVideoProps> = ({
    media,
    autoPlay = false,
    muted = true,
    loop = false,
    controls = false,
    className = '',
    onLoadStart,
    onCanPlay,
    onError,
    quality = 'auto',
    preload = 'metadata'
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [networkSpeed, setNetworkSpeed] = useState<string>('unknown');
    const [deviceType, setDeviceType] = useState<string>('desktop');

    // Detect device and network capabilities
    useEffect(() => {
        const detectCapabilities = () => {
            // Device detection
            const userAgent = navigator.userAgent.toLowerCase();
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

            // Network speed estimation (basic)
            if ('connection' in navigator) {
                const connection = (navigator as any).connection;
                if (connection) {
                    const effectiveType = connection.effectiveType;
                    switch (effectiveType) {
                        case '4g':
                            setNetworkSpeed('fast');
                            break;
                        case '3g':
                            setNetworkSpeed('medium');
                            break;
                        case '2g':
                            setNetworkSpeed('slow');
                            break;
                        default:
                            setNetworkSpeed('unknown');
                    }
                }
            }
        };

        detectCapabilities();
    }, []);

    // Get optimized stream URL with Netflix-level parameters
    const getOptimizedStreamUrl = useCallback((isPreview: boolean = false) => {
        const baseUrl = getApiUrl();
        const endpoint = isPreview ? 'preview-clips' : 'stream';
        let url = `${baseUrl}/api/${endpoint}/${media.id}`;

        const params = new URLSearchParams();

        // Quality optimization based on device and network
        if (quality === 'auto') {
            if (deviceType === 'mobile' || networkSpeed === 'slow') {
                params.set('quality', 'medium');
            } else if (deviceType === 'mac' || deviceType === 'windows' || deviceType === 'linux') {
                params.set('quality', 'high');
            } else {
                params.set('quality', 'high');
            }
        } else {
            params.set('quality', quality);
        }

        // Format optimization
        if (deviceType === 'ios' || deviceType === 'mac') {
            params.set('format', 'mp4'); // iOS prefers MP4
        } else if (deviceType === 'chrome' || deviceType === 'firefox') {
            params.set('format', 'webm'); // Modern browsers support WebM
        }

        // Add performance hints
        params.set('optimize', 'netflix-level');
        params.set('buffer', 'aggressive');
        params.set('latency', 'ultra-low');

        if (params.toString()) {
            url += '?' + params.toString();
        }

        return url;
    }, [media.id, quality, deviceType, networkSpeed]);

    // Netflix-level video optimization
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Ultra-fast loading optimizations
        video.preload = preload;
        video.crossOrigin = 'anonymous';

        // Enable hardware acceleration hints
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('x-webkit-airplay', 'allow');

        // Netflix-level buffering strategy
        if ('buffered' in video) {
            // Set buffer size hints for different devices
            const bufferSize = deviceType === 'mobile' ? '2MB' : '8MB';
            video.setAttribute('x-buffer-size', bufferSize);
        }

        // Event handlers for ultra-fast loading
        const handleLoadStart = () => {
            setIsLoading(true);
            setHasError(false);
            onLoadStart?.();
        };

        const handleCanPlay = () => {
            setIsLoading(false);
            onCanPlay?.();

            // Auto-optimize video settings
            if (video.videoWidth && video.videoHeight) {
                // Adjust quality based on actual video dimensions
                const resolution = video.videoWidth * video.videoHeight;
                if (resolution > 2073600) { // 1920x1080
                    video.setAttribute('x-quality-hint', '1080p');
                } else if (resolution > 921600) { // 1280x720
                    video.setAttribute('x-quality-hint', '720p');
                } else {
                    video.setAttribute('x-quality-hint', '480p');
                }
            }
        };

        const handleError = (e: Event) => {
            setIsLoading(false);
            setHasError(true);
            onError?.(e);

            // Try fallback URL
            const currentSrc = video.src;
            if (!currentSrc.includes('fallback=true')) {
                const fallbackUrl = getOptimizedStreamUrl() + '&fallback=true';
                video.src = fallbackUrl;
                video.load();
            }
        };

        const handleProgress = () => {
            // Monitor buffer health for Netflix-level streaming
            if (video.buffered.length > 0) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                const currentTime = video.currentTime;
                const bufferHealth = bufferedEnd - currentTime;

                // Adjust buffer strategy based on health
                if (bufferHealth < 5) { // Less than 5 seconds buffered
                    video.setAttribute('x-buffer-priority', 'high');
                } else if (bufferHealth > 30) { // More than 30 seconds buffered
                    video.setAttribute('x-buffer-priority', 'low');
                }
            }
        };

        // Add event listeners
        video.addEventListener('loadstart', handleLoadStart);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('error', handleError);
        video.addEventListener('progress', handleProgress);

        return () => {
            video.removeEventListener('loadstart', handleLoadStart);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('error', handleError);
            video.removeEventListener('progress', handleProgress);
        };
    }, [deviceType, getOptimizedStreamUrl, onCanPlay, onError, onLoadStart, preload]);

    // Intelligent source selection for maximum compatibility
    const renderVideoSources = () => {
        const baseUrl = getOptimizedStreamUrl();

        return (
            <>
                {/* Primary optimized source */}
                <source
                    src={baseUrl}
                    type="video/mp4; codecs=&quot;avc1.42E01E, mp4a.40.2&quot;"
                />

                {/* WebM fallback for modern browsers */}
                <source
                    src={`${baseUrl}&format=webm`}
                    type="video/webm; codecs=&quot;vp9, opus&quot;"
                />

                {/* Additional fallbacks */}
                <source
                    src={`${baseUrl}&quality=medium`}
                    type="video/mp4"
                />

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
                autoPlay={autoPlay}
                muted={muted}
                loop={loop}
                controls={controls}
                playsInline
                className="w-full h-full object-cover"
                style={{
                    backgroundColor: '#000',
                    // Hardware acceleration hints
                    transform: 'translateZ(0)',
                    willChange: 'transform',
                }}
            >
                {renderVideoSources()}

                {/* Fallback message */}
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                    <div className="text-center">
                        <p className="mb-2">Video not supported</p>
                        <a
                            href={getOptimizedStreamUrl()}
                            className="text-blue-400 hover:text-blue-300 underline"
                            download={media.title}
                        >
                            Download video
                        </a>
                    </div>
                </div>
            </video>

            {/* Loading indicator */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="flex items-center space-x-2 text-white">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                        <span>Loading...</span>
                    </div>
                </div>
            )}

            {/* Error indicator */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-50">
                    <div className="text-center text-white">
                        <p className="mb-2">Failed to load video</p>
                        <button
                            onClick={() => {
                                setHasError(false);
                                if (videoRef.current) {
                                    videoRef.current.load();
                                }
                            }}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UltraFastVideo;