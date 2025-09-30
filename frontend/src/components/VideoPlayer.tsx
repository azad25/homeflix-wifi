"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, RotateCw, X, Minimize, Subtitles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '@/lib/api';
import { useEnhancedAudio } from '../contexts/EnhancedAudioContext';
import AudioQualityIndicator from './AudioQualityIndicator';
import { updatePlaybackProgress, getPlaybackProgress, trackView } from '@/lib/playback';
import NextEpisodePreview from './NextEpisodePreview';
import { Media } from '@/types/media';

interface VideoPlayerProps {
  media: Media;
  isOpen: boolean;
  onClose: () => void;
  startTime?: number;
  onPlayNext?: (nextMedia: Media) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ media, isOpen, onClose, startTime = 0, onPlayNext }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Enhanced audio integration
  const { 
    alacEngine, 
    spatialProcessor, 
    isALACEnabled, 
    spatialAudioEnabled, 
    dolbyAtmosEnabled,
    audioQuality,
    getMasterVolume,
    setMasterVolume,
    initializeEnhancedAudio,
    toggleSpatialAudio,
    toggleDolbyAtmos
  } = useEnhancedAudio();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [nextEpisode, setNextEpisode] = useState<Media | null>(null);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [availableSubtitles, setAvailableSubtitles] = useState<Array<{language: string, url: string}>>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);

  const getStreamUrl = (mediaId: number) => {
    return `${getApiUrl()}/api/stream/${mediaId}`;
  };

  // Load subtitles
  useEffect(() => {
    const loadSubtitles = async () => {
      if (media.subtitles && media.subtitles.length > 0) {
        const subs = media.subtitles.map((sub: any) => ({
          language: sub.language,
          url: `${getApiUrl()}/api/subtitles/${media.id}?lang=${sub.language}`
        }));
        setAvailableSubtitles(subs);
        if (subs.length > 0) {
          setCurrentSubtitle(subs[0].url);
        }
      }
    };
    
    if (isOpen) {
      loadSubtitles();
    }
  }, [media, isOpen]);

  // Fetch next episode for TV series
  useEffect(() => {
    const fetchNextEpisode = async () => {
      if (media.type === 'episode' && media.series_id && media.season_number && media.episode_number) {
        try {
          const response = await fetch(`${getApiUrl()}/api/media`);
          const allMedia: Media[] = await response.json();
          
          // Find next episode
          const next = allMedia.find((m: Media) => 
            m.series_id === media.series_id &&
            m.season_number === media.season_number &&
            m.episode_number === (media.episode_number || 0) + 1
          );
          
          // If no next episode in current season, try first episode of next season
          if (!next) {
            const nextSeason = allMedia.find((m: Media) => 
              m.series_id === media.series_id &&
              m.season_number === (media.season_number || 0) + 1 &&
              m.episode_number === 1
            );
            setNextEpisode(nextSeason || null);
          } else {
            setNextEpisode(next);
          }
        } catch (error) {
          console.error('Error fetching next episode:', error);
        }
      }
    };
    
    if (isOpen) {
      fetchNextEpisode();
    }
  }, [media, isOpen]);

  const handlePlayNext = () => {
    if (nextEpisode && onPlayNext) {
      onPlayNext(nextEpisode);
    }
  };

  const handleCancelNext = () => {
    setShowNextEpisode(false);
  };

  const toggleSubtitles = () => {
    setSubtitlesEnabled(!subtitlesEnabled);
    const video = videoRef.current;
    if (video) {
      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = subtitlesEnabled ? 'hidden' : 'showing';
      }
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      video.volume = volume > 0 ? volume : 0.5;
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  const seekForward = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(video.currentTime + seconds, duration);
  };

  const seekBackward = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(video.currentTime - seconds, 0);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
        if (screen.orientation && (screen.orientation as any).lock) {
          (screen.orientation as any).lock('landscape').catch(() => {});
        }
      }).catch(console.error);
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        if (screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock();
        }
      }).catch(console.error);
    }
  };

  const exitFullscreen = () => {
    document.exitFullscreen().then(() => {
      setIsFullscreen(false);
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    }).catch(console.error);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = parseFloat(e.target.value) / 100;
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    video.muted = newVolume === 0;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const progressBar = e.currentTarget;
    if (!video || !progressBar) return;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    const newTime = percentage * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newTime = (parseFloat(e.target.value) / 100) * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Keyboard shortcuts handler
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    
    switch (e.key.toLowerCase()) {
      case 'f':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'escape':
        e.preventDefault();
        if (isFullscreen) {
          exitFullscreen();
        } else {
          onClose();
        }
        break;
      case 'arrowright':
        e.preventDefault();
        seekForward(10);
        break;
      case 'arrowleft':
        e.preventDefault();
        seekBackward(10);
        break;
      case 'm':
        e.preventDefault();
        toggleMute();
        break;
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
    }
  }, [isOpen, isFullscreen, onClose]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      // Set start time if provided
      if (startTime > 0) {
        video.currentTime = startTime;
        setCurrentTime(startTime);
      }
    };

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(video.currentTime);
        // Update playback progress every 10 seconds
        if (Math.floor(video.currentTime) % 10 === 0) {
          updatePlaybackProgress(media.id, video.currentTime, video.duration);
        }
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      // Track view when playback starts
      trackView(media.id);
    };
    
    const handlePause = () => {
      setIsPlaying(false);
      // Update progress when paused
      updatePlaybackProgress(media.id, video.currentTime, video.duration);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      // Mark as completed when ended
      updatePlaybackProgress(media.id, video.duration, video.duration);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [isDragging, media.id, startTime]);

  // Keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  // Auto-hide controls
  useEffect(() => {
    if (!isOpen) return;

    const resetTimeout = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      setShowControls(true);
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    };

    const handleMouseMove = () => resetTimeout();
    
    resetTimeout();
    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isOpen, isPlaying]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black"
        ref={containerRef}
      >
        {/* Video */}
        <video
          ref={videoRef}
          src={getStreamUrl(media.id)}
          className="w-full h-full object-contain bg-black"
          onPlay={() => setIsPlaying(true)}
          autoPlay
          controls={false}
          playsInline
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={(e) => {
            console.error('Video error:', e);
            console.log('Video src:', getStreamUrl(media.id));
          }}
          onLoadStart={() => console.log('Video loading started')}
          onCanPlay={() => console.log('Video can play')}
          preload="metadata"
          muted={false}
        />


        {/* Controls Overlay */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 pointer-events-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Controls */}
              <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center pointer-events-auto">
                <div>
                  <h1 className="text-white text-2xl font-bold">{media.title}</h1>
                  <p className="text-white/70">{media.type} • {formatTime(duration)}</p>
                </div>
                
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => onClose()}
                    className="text-white hover:text-red-500 transition-colors p-3 bg-black/50 rounded-full hover:bg-black/70 border border-white/20 hover:border-red-500/50 z-50"
                    title="Close (Esc)"
                    type="button"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Center Controls */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                <div className="flex items-center gap-8">
                  {/* Skip Back 10s */}
                  <button
                    onClick={() => seekBackward(10)}
                    className="bg-black/50 text-white rounded-full p-3 hover:bg-black/70 transition-all duration-200 hover:scale-110"
                    title="Skip back 10 seconds (←)"
                  >
                    <RotateCcw className="w-8 h-8" />
                  </button>

                  {/* Play/Pause */}
                  <button
                    onClick={togglePlay}
                    className="bg-black/50 text-white rounded-full p-4 hover:bg-black/70 transition-all duration-200 hover:scale-110 z-40"
                    title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                    type="button"
                  >
                    {isPlaying ? (
                      <Pause className="w-12 h-12" />
                    ) : (
                      <Play className="w-12 h-12 fill-current" />
                    )}
                  </button>

                  {/* Skip Forward 10s */}
                  <button
                    onClick={() => seekForward(10)}
                    className="bg-black/50 text-white rounded-full p-3 hover:bg-black/70 transition-all duration-200 hover:scale-110"
                    title="Skip forward 10 seconds (→)"
                  >
                    <RotateCw className="w-8 h-8" />
                  </button>
                </div>
              </div>

              {/* Bottom Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-auto">
                {/* Progress Bar */}
                <div className="mb-4 group">
                  <div 
                    className="relative w-full h-1 bg-white/30 rounded-lg cursor-pointer group-hover:h-2 transition-all duration-200"
                    onClick={handleProgressClick}
                  >
                    {/* Progress Fill */}
                    <div 
                      className="absolute top-0 left-0 h-full bg-red-600 rounded-lg transition-all duration-200"
                      style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                    />
                    
                    {/* Progress Handle */}
                    <div 
                      className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                    />
                    
                    {/* Hidden Range Input for Accessibility and Dragging */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={duration > 0 ? (currentTime / duration) * 100 : 0}
                      onChange={handleSeek}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={togglePlay}
                      className="text-white hover:text-white/70 transition-colors"
                      title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                    >
                      {isPlaying ? (
                        <Pause className="w-8 h-8" />
                      ) : (
                        <Play className="w-8 h-8 fill-current" />
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => seekBackward(10)}
                        className="text-white hover:text-red-500 transition-colors flex items-center gap-1"
                        title="Skip back 10 seconds (←)"
                      >
                        <RotateCcw className="w-5 h-5" />
                        <span className="text-xs">10</span>
                      </button>

                      <button
                        onClick={() => seekForward(10)}
                        className="text-white hover:text-red-500 transition-colors flex items-center gap-1"
                        title="Skip forward 10 seconds (→)"
                      >
                        <RotateCw className="w-5 h-5" />
                        <span className="text-xs">10</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleMute}
                        className="text-white hover:text-white/70 transition-colors"
                        title={isMuted ? "Unmute (m)" : "Mute (m)"}
                      >
                        {isMuted ? (
                          <VolumeX className="w-6 h-6" />
                        ) : (
                          <Volume2 className="w-6 h-6" />
                        )}
                      </button>

                      <button
                        onClick={toggleSubtitles}
                        className={`text-white hover:text-white/70 transition-colors ${
                          subtitlesEnabled ? 'text-blue-400' : ''
                        }`}
                        title={subtitlesEnabled ? "Disable Subtitles (c)" : "Enable Subtitles (c)"}
                      >
                        <Subtitles className="w-6 h-6" />
                      </button>

                      <span className="text-white text-sm">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Audio Quality Indicator */}
                    <AudioQualityIndicator />
                    
                    <button
                      onClick={toggleFullscreen}
                      className="text-white hover:text-white/70 transition-colors"
                      title={isFullscreen ? "Exit Fullscreen (f)" : "Enter Fullscreen (f)"}
                    >
                      {isFullscreen ? (
                        <Minimize className="w-6 h-6" />
                      ) : (
                        <Maximize className="w-6 h-6" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Next Episode Preview */}
        {nextEpisode && (
          <NextEpisodePreview
            nextEpisode={nextEpisode}
            currentTime={currentTime}
            duration={duration}
            onPlayNext={handlePlayNext}
            onCancel={handleCancelNext}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default VideoPlayer;
