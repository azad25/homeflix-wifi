/**
 * Netflix-style optimized video component with adaptive streaming
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNetflixAssetLoader } from '@/lib/netflixAssetLoader';

interface NetflixVideoProps {
  src: string;
  className?: string;
  priority?: 'high' | 'medium' | 'low';
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: boolean;
  controls?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onPlay?: () => void;
  onPause?: () => void;
  placeholder?: React.ReactNode;
  poster?: string;
}

export const NetflixVideo: React.FC<NetflixVideoProps> = ({
  src,
  className = '',
  priority = 'medium',
  autoPlay = false,
  muted = true,
  loop = false,
  preload = true,
  controls = false,
  onLoad,
  onError,
  onPlay,
  onPause,
  placeholder,
  poster
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { loadVideo } = useNetflixAssetLoader();

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    onPlay?.();
  }, [onPlay]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    onPause?.();
  }, [onPause]);

  const handleVideoLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleVideoError = useCallback((error: Error) => {
    setHasError(true);
    setIsLoading(false);
    onError?.(error);
  }, [onError]);

  useEffect(() => {
    if (!src) return;

    const loadVideoAsset = async () => {
      try {
        setIsLoading(true);
        setHasError(false);

        const video = await loadVideo(src, {
          priority,
          preload,
          timeout: 15000
        });

        // Configure video for Netflix-style playback
        video.muted = muted;
        video.loop = loop;
        video.controls = controls;
        video.playsInline = true;
        video.disablePictureInPicture = true;
        
        // Safari-specific attributes
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('playsinline', 'true');
        
        if (poster) {
          video.poster = poster;
        }

        // Add event listeners
        video.addEventListener('loadeddata', handleVideoLoad);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('error', () => {
          handleVideoError(new Error('Video playback failed'));
        });

        // Apply styles
        video.className = `w-full h-full object-cover ${className}`;
        
        // Add to container
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(video);
        }

        setVideoElement(video);

        // Auto-play if requested
        if (autoPlay) {
          try {
            await video.play();
          } catch (playError) {
            console.warn('Autoplay failed:', playError);
            // Fallback: try playing muted
            video.muted = true;
            try {
              await video.play();
            } catch (mutedPlayError) {
              console.warn('Muted autoplay also failed:', mutedPlayError);
            }
          }
        }

      } catch (error) {
        console.error('NetflixVideo loading failed:', error);
        handleVideoError(error as Error);
      }
    };

    loadVideoAsset();

    return () => {
      if (videoElement) {
        videoElement.removeEventListener('loadeddata', handleVideoLoad);
        videoElement.removeEventListener('play', handlePlay);
        videoElement.removeEventListener('pause', handlePause);
      }
    };
  }, [src, priority, preload, muted, loop, controls, autoPlay, poster, className, loadVideo, handleVideoLoad, handlePlay, handlePause, handleVideoError, videoElement]);

  const togglePlay = useCallback(async () => {
    if (!videoElement) return;

    try {
      if (isPlaying) {
        videoElement.pause();
      } else {
        await videoElement.play();
      }
    } catch (error) {
      console.error('Play/pause failed:', error);
    }
  }, [videoElement, isPlaying]);

  const toggleMute = useCallback(() => {
    if (!videoElement) return;
    videoElement.muted = !videoElement.muted;
  }, [videoElement]);

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden bg-gray-900 ${className}`}
      onClick={!controls ? togglePlay : undefined}
    >
      {isLoading && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
          {placeholder || (
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Loading video...</p>
            </div>
          )}
        </div>
      )}
      
      {hasError && (
        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
          <div className="text-gray-400 text-center">
            <svg className="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12l4-4m0 4l-4-4" />
            </svg>
            <p className="text-sm">Video unavailable</p>
          </div>
        </div>
      )}

      {/* Custom controls overlay for non-controls mode */}
      {!controls && !isLoading && !hasError && (
        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center group">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={togglePlay}
              className="bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-3 transition-all duration-200"
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
          
          {/* Mute button */}
          <button
            onClick={toggleMute}
            className="absolute bottom-4 right-4 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-300"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.824L4.5 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.5l3.883-3.824a1 1 0 011.617.824zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default NetflixVideo;
