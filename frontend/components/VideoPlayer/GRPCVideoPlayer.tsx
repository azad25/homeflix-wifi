import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useVideoStreaming, usePlaybackControl, useProgressTracking } from '@/hooks/useGRPCStreaming';

interface GRPCVideoPlayerProps {
  mediaUuid: string;
  userId: string;
  quality?: string;
  autoPlay?: boolean;
  onProgress?: (progress: number, currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
}

export const GRPCVideoPlayer: React.FC<GRPCVideoPlayerProps> = ({
  mediaUuid,
  userId,
  quality = 'auto',
  autoPlay = false,
  onProgress,
  onEnded,
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random()}`);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // gRPC hooks
  const { startStreaming, isLoading, error, progress, videoUrl } = useVideoStreaming(mediaUuid, quality);
  const { connect, play, pause, seek, playbackStatus, isConnected } = usePlaybackControl(sessionId, mediaUuid);
  const { startTracking, updateProgress, isTracking } = useProgressTracking(sessionId, mediaUuid, userId);

  // Initialize streaming and connections
  useEffect(() => {
    if (mediaUuid) {
      startStreaming();
      connect();
      startTracking();
    }
  }, [mediaUuid, startStreaming, connect, startTracking]);

  // Set video source when URL is available
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.src = videoUrl;
      if (autoPlay) {
        videoRef.current.play().catch(console.error);
      }
    }
  }, [videoUrl, autoPlay]);

  // Handle video events
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setCurrentTime(current);

      // Update progress via gRPC
      if (isTracking && total > 0) {
        const progressPercent = current / total;
        updateProgress(progressPercent, current, total, progressPercent >= 0.9);
        onProgress?.(progressPercent, current, total);
      }
    }
  }, [isTracking, updateProgress, onProgress]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    if (isConnected) {
      play();
    }
  }, [isConnected, play]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (isConnected) {
      pause();
    }
  }, [isConnected, pause]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    onEnded?.();
  }, [onEnded]);

  const handleError = useCallback((e: any) => {
    const errorMessage = e.target?.error?.message || 'Video playback error';
    onError?.(errorMessage);
  }, [onError]);

  // Playback controls
  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.error);
      }
    }
  }, [isPlaying]);

  const handleSeek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      if (isConnected) {
        seek(time);
      }
    }
  }, [isConnected, seek]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  }, []);

  const handleMuteToggle = useCallback(() => {
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  }, [isMuted]);

  // Format time for display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle gRPC errors
  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  return (
    <div className="relative w-full bg-black rounded-lg overflow-hidden">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p>Loading video... {Math.round(progress * 100)}%</p>
            <div className="w-64 bg-gray-700 rounded-full h-2 mt-2">
              <div 
                className="bg-red-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
        playsInline
      />

      {/* Custom controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="relative">
            <div className="w-full bg-gray-600 rounded-full h-1">
              <div 
                className="bg-red-600 h-1 rounded-full transition-all duration-100"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              ></div>
            </div>
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="absolute inset-0 w-full h-1 opacity-0 cursor-pointer"
            />
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center space-x-4">
            {/* Play/Pause button */}
            <button
              onClick={handlePlayPause}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
              disabled={isLoading}
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

            {/* Volume control */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleMuteToggle}
                className="p-1 hover:bg-white hover:bg-opacity-20 rounded"
              >
                {isMuted || volume === 0 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.414 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.414l3.969-3.816a1 1 0 011.617.816zM14.657 5.343a1 1 0 011.414 0A9.972 9.972 0 0118 10a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0016 10c0-1.636-.525-3.153-1.343-4.243a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.414 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.414l3.969-3.816a1 1 0 011.617.816zM14.657 5.343a1 1 0 011.414 0A9.972 9.972 0 0118 10a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0016 10c0-1.636-.525-3.153-1.343-4.243a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Time display */}
            <div className="text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Connection status */}
          <div className="flex items-center space-x-2 text-sm">
            {isConnected && (
              <span className="flex items-center text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                Live
              </span>
            )}
            {isTracking && (
              <span className="text-blue-400">Syncing</span>
            )}
          </div>
        </div>
      </div>

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-20">
          <div className="text-white text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-lg font-semibold mb-2">Playback Error</p>
            <p className="text-gray-300">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};