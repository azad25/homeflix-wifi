"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, RotateCw, X, Minimize, Subtitles, Tv } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '@/lib/api';
import RedLoader from './RedLoader';
import CastButton from './CastButton';
import { useChromecast, CastMedia } from '@/hooks/useChromecast';

import { updatePlaybackProgress, getPlaybackProgress, trackView, initializePlaybackProgress } from '@/lib/playback';
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
  
  // State declarations
  const [showPauseScreen, setShowPauseScreen] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string>('');
  
  // Debug component lifecycle
  useEffect(() => {
    console.log('VideoPlayer component mounted/updated:', { 
      mediaId: media.id, 
      isOpen, 
      showPauseScreen, 
      videoSrc,
      timestamp: new Date().toISOString()
    });
    return () => {
      console.log('VideoPlayer component will unmount at:', new Date().toISOString());
    };
  }, [media.id, isOpen, showPauseScreen, videoSrc]);

  // Chromecast integration
  const {
    castState,
    connect: connectToCast,
    disconnect: disconnectFromCast,
    loadMedia: loadCastMedia,
    play: playCast,
    pause: pauseCast,
    seek: seekCast,
    setVolume: setCastVolume,
    setMuted: setCastMuted,
  } = useChromecast();



  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [nextEpisode, setNextEpisode] = useState<Media | null>(null);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [availableSubtitles, setAvailableSubtitles] = useState<Array<{ language: string, url: string }>>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);
  const [dragStartTime, setDragStartTime] = useState<number | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showResumeNotification, setShowResumeNotification] = useState(false);
  const [resumeTime, setResumeTime] = useState(0);
  const [isCasting, setIsCasting] = useState(false);
  const [isTranscoded, setIsTranscoded] = useState(false);

  const getStreamUrl = useCallback((mediaId: number, quality?: string, format?: string, seekTime?: number) => {
    const baseUrl = `${getApiUrl()}/api/stream/${mediaId}`;
    const params = new URLSearchParams();

    // Static optimization parameters to prevent URL changes
    params.set('optimize', 'netflix-level');
    params.set('buffer', 'ultra-aggressive');
    params.set('latency', 'zero');
    params.set('preload', 'instant');

    // Use fixed quality to prevent dynamic URL changes
    if (quality) {
      params.set('quality', quality);
    } else {
      params.set('quality', 'high'); // Fixed quality to prevent URL changes
    }

    if (format) {
      params.set('format', format);
    }

    // Only add seek time for transcoded streams (not for regular playback)
    if (seekTime && seekTime > 0) {
      params.set('t', seekTime.toString());
      params.set('seek', seekTime.toString());
      console.log('Adding seek time to stream URL:', seekTime);
    }

    return `${baseUrl}?${params.toString()}`;
  }, []);

  // Function to handle seeking in transcoded streams
  const seekTranscodedVideo = async (seekTime: number) => {
    const video = videoRef.current;
    if (!video) return;

    console.log('Seeking transcoded video to:', seekTime);
    setIsBuffering(true);

    // Store current playback state
    const wasPlaying = !video.paused;

    try {
      // Generate new stream URL with seek time
      const newStreamUrl = getStreamUrl(media.id, 'high', 'mp4', seekTime);
      console.log('New stream URL with seek time:', newStreamUrl);

      // Update video source
      video.src = newStreamUrl;

      // Update current time state immediately for UI responsiveness
      setCurrentTime(seekTime);

      // Wait for video to load and then resume playback if it was playing
      const handleCanPlay = () => {
        setIsBuffering(false);
        if (wasPlaying) {
          video.play().catch(console.error);
        }
        video.removeEventListener('canplay', handleCanPlay);
      };

      video.addEventListener('canplay', handleCanPlay);

      // Load the new stream
      video.load();

    } catch (error) {
      console.error('Error seeking transcoded video:', error);
      setIsBuffering(false);
    }
  };

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      setIsMobile(/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase()));
    };
    checkMobile();
  }, []);

  // Initialize video source once when player opens
  useEffect(() => {
    if (isOpen && media.id && !videoSrc) {
      const initialVideoSrc = getStreamUrl(media.id, 'high', 'mp4');
      console.log('Setting initial video source (STATIC):', initialVideoSrc);
      setVideoSrc(initialVideoSrc);
    }
  }, [media.id, isOpen, videoSrc, getStreamUrl]);

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

  // Handle cast state changes
  useEffect(() => {
    setIsCasting(castState.isConnected);

    // Update local state with cast state when casting
    if (castState.isConnected) {
      setIsPlaying(castState.playerState === 'PLAYING');
      setCurrentTime(castState.currentTime);
      setDuration(castState.duration);
      setVolume(castState.volumeLevel);
      setIsMuted(castState.isMuted);
    }
  }, [castState]);

  // Handle cast button click
  const handleCastClick = useCallback(() => {
    if (castState.isConnected) {
      disconnectFromCast();
    } else {
      connectToCast();
    }
  }, [castState.isConnected, connectToCast, disconnectFromCast]);

  // Load media to cast device when connected
  useEffect(() => {
    if (castState.isConnected && media && !isCasting) {
      const streamUrl = getStreamUrl(media.id, '4k', 'mp4');
      const thumbnailUrl = `${getApiUrl()}/api/thumbnails/${media.id}`;

      const castMedia: CastMedia = {
        contentId: streamUrl,
        contentType: 'video/mp4',
        title: media.title,
        subtitle: media.type === 'episode'
          ? `S${media.season_number}E${media.episode_number}`
          : `${media.year || ''} • ${media.genres || ''}`,
        metadata: {
          title: media.title,
          subtitle: media.type === 'episode'
            ? `S${media.season_number}E${media.episode_number}`
            : `${media.year || ''} • ${media.genres || ''}`,
          images: [{
            url: thumbnailUrl
          }]
        }
      };

      loadCastMedia(castMedia);
      setIsCasting(true);

      // Pause local video when casting starts
      const video = videoRef.current;
      if (video && !video.paused) {
        video.pause();
      }
    }
  }, [castState.isConnected, media, loadCastMedia, isCasting]);

  const handlePlayNext = () => {
    console.log('VideoPlayer: handlePlayNext called', { nextEpisode, onPlayNext: !!onPlayNext });
    if (nextEpisode && onPlayNext) {
      console.log('VideoPlayer: Calling onPlayNext with:', nextEpisode.title);
      onPlayNext(nextEpisode);
    } else {
      console.warn('VideoPlayer: Cannot play next - missing nextEpisode or onPlayNext callback');
    }
  };

  const handleCancelNext = () => {
    setShowNextEpisode(false);
  };

  const handleResumePlayback = () => {
    const video = videoRef.current;
    if (video && resumeTime > 0) {
      video.currentTime = resumeTime;
      setCurrentTime(resumeTime);
      setShowResumeNotification(false);
    }
  };

  const handleStartFromBeginning = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      setCurrentTime(0);
      setShowResumeNotification(false);
    }
  };

  // Utility function to format time in MM:SS or HH:MM:SS format
  const formatTime = (seconds: number): string => {
    if (!seconds || !isFinite(seconds)) return '00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = useCallback(async () => {
    if (isCasting && castState.isConnected) {
      if (isPlaying) {
        pauseCast();
      } else {
        playCast();
      }
      return;
    }

    const video = videoRef.current;
    if (!video) {
      console.log('No video element found in togglePlay');
      return;
    }

    if (video.paused) {
      console.log('Toggling play - resuming from current position:', video.currentTime);
      // Just resume playback from current position
      video.play().then(() => {
        console.log('Toggle play successful');
      }).catch(error => {
        console.error('Failed to toggle play:', error);
      });
    } else {
      console.log('Toggling pause at time:', video.currentTime);
      
      // Save progress before pausing
      if (video.currentTime > 5) {
        const currentDuration = duration || (video.seekable && video.seekable.length > 0 ? video.seekable.end(video.seekable.length - 1) : 0);
        if (currentDuration > 0) {
          try {
            await updatePlaybackProgress(media.id, video.currentTime, currentDuration);
            console.log('Progress saved before toggle pause:', video.currentTime, 'of', currentDuration);
          } catch (error) {
            console.error('Failed to save progress before toggle pause:', error);
          }
        }
      }
      
      video.pause();
    }
  }, [isCasting, castState.isConnected, isPlaying, pauseCast, playCast, duration, media.id]);

  const toggleMute = () => {
    if (isCasting && castState.isConnected) {
      setCastMuted(!castState.isMuted);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Math.max(0, Math.min(1, parseFloat(e.target.value) / 100));
    setVolume(newVolume);

    if (isCasting && castState.isConnected) {
      setCastVolume(newVolume);
      return;
    }

    const video = videoRef.current;
    if (video) {
      video.volume = newVolume;
      video.muted = newVolume === 0;
      setIsMuted(newVolume === 0);
    }
  };

  const seekForward = (seconds: number) => {
    if (isCasting && castState.isConnected) {
      const newTime = Math.min(castState.currentTime + seconds, castState.duration);
      seekCast(newTime);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // For videos without duration, just seek forward without upper limit check
    let newTime = video.currentTime + seconds;

    // Only apply upper limit if we have a valid duration
    if (duration && duration > 0) {
      newTime = Math.min(newTime, duration);
    }

    console.log(`Seeking forward ${seconds}s to ${newTime}s`);

    setIsBuffering(true);
    try {
      video.currentTime = newTime;
      setCurrentTime(newTime);
    } catch (error) {
      console.error('Error seeking forward:', error);
      setIsBuffering(false);
    }
  };

  const seekBackward = (seconds: number) => {
    if (isCasting && castState.isConnected) {
      const newTime = Math.max(castState.currentTime - seconds, 0);
      seekCast(newTime);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Always allow backward seeking, just ensure we don't go below 0
    const newTime = Math.max(video.currentTime - seconds, 0);
    console.log(`Seeking backward ${seconds}s to ${newTime}s`);

    setIsBuffering(true);
    try {
      video.currentTime = newTime;
      setCurrentTime(newTime);
    } catch (error) {
      console.error('Error seeking backward:', error);
      setIsBuffering(false);
    }
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    const container = containerRef.current;

    if (!container || !video) return;

    // For iOS Safari, use video element fullscreen
    if (isMobile && (video as any).webkitEnterFullscreen) {
      if (!isFullscreen) {
        (video as any).webkitEnterFullscreen();
      } else {
        (video as any).webkitExitFullscreen();
      }
      return;
    }

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(console.error);
      setShowControls(true); // Show controls when entering fullscreen
    } else {
      document.exitFullscreen().catch(console.error);
      setShowControls(true); // Show controls when exiting fullscreen
    }
  };

  // Pause screen visibility logic
  useEffect(() => {
    console.log('Pause screen logic:', { isPlaying, isLoading, isBuffering, isOpen, isCasting, showPauseScreen });
    
    if (!isPlaying && !isLoading && !isBuffering && isOpen && !isCasting) {
      // Add a small delay to ensure the video has actually paused
      const timer = setTimeout(() => {
        console.log('Setting pause screen to true');
        setShowPauseScreen(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      if (showPauseScreen) {
        console.log('Setting pause screen to false');
      }
      setShowPauseScreen(false);
    }
  }, [isPlaying, isLoading, isBuffering, isOpen, isCasting]);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setShowControls(true); // Show controls when toggling fullscreen
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const progressBar = e.currentTarget;
    if (!progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clickX = clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));

    if (isCasting && castState.isConnected) {
      const newTime = percentage * castState.duration;
      seekCast(newTime);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Simplified duration detection
    let targetDuration = duration;

    // If no duration from metadata, try seekable range
    if (!targetDuration || targetDuration === 0) {
      if (video.seekable && video.seekable.length > 0) {
        targetDuration = video.seekable.end(video.seekable.length - 1);
        console.log('Using seekable duration:', targetDuration);
      } else {
        // Conservative fallback - don't allow seeking without duration
        console.warn('No duration available - seeking disabled');
        return;
      }
    }

    const newTime = Math.max(0, Math.min(percentage * targetDuration, targetDuration));
    console.log(`Seeking to ${newTime}s (${percentage * 100}%) of ${targetDuration}s`);

    // Improved seeking with better error handling
    setIsBuffering(true);

    const performSeek = () => {
      try {
        console.log(`Attempting to seek to ${newTime}s (video duration: ${video.duration}, seekable: ${video.seekable?.length ? video.seekable.end(0) : 'none'})`);

        // Check if the video is ready for seeking
        if (video.readyState < 2) {
          console.warn('Video not ready for seeking, waiting...');
          video.addEventListener('loadeddata', performSeek, { once: true });
          return;
        }

        // Perform the seek
        video.currentTime = newTime;
        setCurrentTime(newTime);

        // Listen for seek completion
        const handleSeeked = () => {
          console.log(`Seek completed to ${video.currentTime}s`);
          setIsBuffering(false);
          video.removeEventListener('seeked', handleSeeked);
        };

        const handleSeekError = () => {
          console.error('Seek operation failed');
          setIsBuffering(false);
          video.removeEventListener('error', handleSeekError);
        };

        video.addEventListener('seeked', handleSeeked, { once: true });
        video.addEventListener('error', handleSeekError, { once: true });

        // Fallback timeout
        setTimeout(() => {
          setIsBuffering(false);
        }, 3000);

      } catch (error) {
        console.error('Error during seek operation:', error);
        setIsBuffering(false);
      }
    };

    performSeek();
  };

  const handleSeekStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent click events from bubbling up

    const video = videoRef.current;
    const wasPlaying = video && !video.paused;

    // Pause video during dragging to prevent auto-play
    if (video && wasPlaying) {
      video.pause();
    }

    setIsDragging(true);
    setDragStartTime(currentTime);

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();

      // Get current duration
      let currentDuration = isCasting && castState.isConnected ? castState.duration : duration;

      // If no duration, try seekable range
      if (!currentDuration || currentDuration === 0) {
        if (video && video.seekable && video.seekable.length > 0) {
          currentDuration = video.seekable.end(video.seekable.length - 1);
        } else {
          // No duration available - skip dragging
          return;
        }
      }

      const progressBar = e.currentTarget as HTMLElement;
      const rect = progressBar.getBoundingClientRect();
      const clientX = 'touches' in moveEvent ? (moveEvent as TouchEvent).touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newTime = Math.max(0, Math.min(percentage * currentDuration, currentDuration));

      if (isCasting && castState.isConnected) {
        seekCast(newTime);
      } else if (video) {
        // Use robust seeking during drag
        try {
          if (video.readyState >= 2) {
            video.currentTime = newTime;
            setCurrentTime(newTime);
          } else {
            // Just update UI if video not ready
            setCurrentTime(newTime);
          }
        } catch (error) {
          // If seeking fails during drag, just update UI
          setCurrentTime(newTime);
          console.warn('Seek failed during drag:', error);
        }
      }
    };

    const handleEnd = (endEvent: MouseEvent | TouchEvent) => {
      endEvent.preventDefault();
      endEvent.stopPropagation();

      setIsDragging(false);

      // Resume playback if it was playing before dragging
      if (video && wasPlaying) {
        video.play().catch(console.error);
      }

      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);
  };

  // Handle mouse movement to show/hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);

      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }

      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    };

    const container = containerRef.current;

    // Use document for fullscreen mode, container for normal mode
    const targetElement = document.fullscreenElement ? document : container;

    if (targetElement) {
      targetElement.addEventListener('mousemove', handleMouseMove);

      // Also handle touch events for mobile
      if (isMobile) {
        targetElement.addEventListener('touchstart', handleMouseMove);
      }

      return () => {
        targetElement.removeEventListener('mousemove', handleMouseMove);
        if (isMobile) {
          targetElement.removeEventListener('touchstart', handleMouseMove);
        }
      };
    }
  }, [isPlaying, isMobile]);

  const handleClose = useCallback(async () => {
    console.log('handleClose called');
    const video = videoRef.current;
    if (video) {
      video.pause();

      // Save progress when explicitly closing the video
      if (video.currentTime > 30) { // Only save if watched more than 30 seconds
        const currentDuration = duration || (video.seekable && video.seekable.length > 0 ? video.seekable.end(video.seekable.length - 1) : 0);
        try {
          await updatePlaybackProgress(media.id, video.currentTime, currentDuration);
          console.log('Progress saved on close:', video.currentTime);
        } catch (error) {
          console.log('Failed to save progress on close:', error);
        }
      }
    }
    onClose();
  }, [duration, media.id, onClose]);

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



  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('Key pressed:', e.code, 'Player open:', isOpen);
      
      // Prevent default behavior for video player keys
      if (['Space', 'ArrowLeft', 'ArrowRight', 'KeyF', 'KeyM', 'KeyC', 'Escape'].includes(e.code)) {
        e.preventDefault();
      }

      switch (e.code) {
        case 'Space':
          console.log('Space key pressed - toggling play');
          togglePlay();
          break;
        case 'ArrowLeft':
          seekBackward(10);
          break;
        case 'ArrowRight':
          seekForward(10);
          break;
        case 'KeyF':
          toggleFullscreen();
          break;
        case 'KeyM':
          toggleMute();
          break;
        case 'KeyC':
          toggleSubtitles();
          break;
        case 'Escape':
          console.log('Escape key pressed - closing player');
          e.preventDefault();
          e.stopPropagation();
          handleClose();
          break;
      }
    };

    // Add event listener when video player is open
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, togglePlay, seekBackward, seekForward, toggleFullscreen, toggleMute, toggleSubtitles, handleClose]);

  // Periodic progress saving and cleanup
  useEffect(() => {
    let progressInterval: NodeJS.Timeout;

    if (isOpen) {
      // Save progress every 15 seconds while playing (more frequent saves)
      progressInterval = setInterval(() => {
        const video = videoRef.current;
        if (video && !video.paused && video.currentTime > 10) {
          const currentDuration = duration || (video.seekable && video.seekable.length > 0 ? video.seekable.end(video.seekable.length - 1) : 0);
          if (currentDuration > 0) {
            updatePlaybackProgress(media.id, video.currentTime, currentDuration).catch(console.error);
            console.log('Periodic progress saved:', video.currentTime, 'of', currentDuration);
          }
        }
      }, 15000); // Every 15 seconds for better progress tracking
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }

      if (progressInterval) {
        clearInterval(progressInterval);
      }

      // Save progress when component unmounts (video player closes)
      const video = videoRef.current;
      if (video && video.currentTime > 30) {
        const currentDuration = duration || (video.seekable && video.seekable.length > 0 ? video.seekable.end(video.seekable.length - 1) : 0);
        if (currentDuration > 0) {
          updatePlaybackProgress(media.id, video.currentTime, currentDuration).catch(console.error);
          console.log('Final progress saved on close:', video.currentTime);
        }
      }
    };
  }, [isOpen, media.id, duration]);

  // ...
  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black"
          ref={containerRef}
        >
          {/* Video */}
          <video
            key={`video-${media.id}`}
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-contain bg-black"
            onPlay={() => {
              const video = videoRef.current;
              console.log('Video play event triggered - resuming from position:', video?.currentTime);
              setIsPlaying(true);
              // Don't immediately hide pause screen, let it fade out naturally
              setIsBuffering(false); // Clear any buffering state
            }}
            autoPlay
            controls={false}
            playsInline
            webkit-playsinline="true"
            onPause={async () => {
              const video = videoRef.current;
              console.log('Video pause event triggered at time:', video?.currentTime);
              setIsPlaying(false);
              
              // Save progress immediately when pausing
              if (video && video.currentTime > 5) {
                const currentDuration = duration || (video.seekable && video.seekable.length > 0 ? video.seekable.end(video.seekable.length - 1) : 0);
                if (currentDuration > 0) {
                  try {
                    await updatePlaybackProgress(media.id, video.currentTime, currentDuration);
                    console.log('Progress saved on pause:', video.currentTime, 'of', currentDuration);
                  } catch (error) {
                    console.error('Failed to save progress on pause:', error);
                  }
                }
              }
            }}
            onEnded={() => setIsPlaying(false)}
            onError={(e) => {
              console.error('Video error:', e);
              console.log('Video src:', getStreamUrl(media.id));
            }}
            onClick={async (e) => {
              // Ensure sound is always on when clicking video
              if (videoRef.current) {
                const video = videoRef.current;
                video.muted = false;
                video.volume = volume > 0 ? volume : 1.0;
                setIsMuted(false);

                if (video.paused) {
                  console.log('Resuming video from video click');
                  // Just resume playback, don't reload or make new requests
                  video.play().catch(error => {
                    console.log('Play failed on video click:', error);
                  });
                } else {
                  console.log('Pausing video from video click at time:', video.currentTime);
                  
                  // Save progress before pausing
                  if (video.currentTime > 5) {
                    const currentDuration = duration || (video.seekable && video.seekable.length > 0 ? video.seekable.end(video.seekable.length - 1) : 0);
                    if (currentDuration > 0) {
                      try {
                        await updatePlaybackProgress(media.id, video.currentTime, currentDuration);
                        console.log('Progress saved before video click pause:', video.currentTime, 'of', currentDuration);
                      } catch (error) {
                        console.error('Failed to save progress before video click pause:', error);
                      }
                    }
                  }
                  
                  video.pause();
                }
              }
            }}
            onLoadStart={() => {
              console.log('Video loading started');
              setIsLoading(true);
              setIsBuffering(true);

              // For now, disable transcoded seeking until backend supports it
              setIsTranscoded(false);
              console.log('Transcoded seeking disabled - using standard seeking');
            }}
            onCanPlay={() => {
              console.log('Video can play');
              setIsLoading(false);
              setIsBuffering(false);
            }}
            onLoadedMetadata={async () => {
              const video = videoRef.current;
              if (!video) return;

              console.log('Video metadata loaded, duration:', video.duration, 'currentTime:', video.currentTime);

              // Handle videos with invalid or missing duration
              let videoDuration = video.duration;
              if (!videoDuration || videoDuration === 0 || !isFinite(videoDuration)) {
                console.log('Video has invalid duration, attempting to detect...');
                // Try to get duration from video element properties
                videoDuration = video.seekable && video.seekable.length > 0
                  ? video.seekable.end(video.seekable.length - 1)
                  : 0;

                // If still no duration, don't set a fallback yet - we'll handle this dynamically
                if (!videoDuration || videoDuration === 0) {
                  console.log('No duration available, will use dynamic seeking');
                  videoDuration = 0; // Keep as 0 to indicate unknown duration
                }
              }

              setDuration(videoDuration);
              console.log('Final duration set to:', videoDuration);

              // Initialize progress if it doesn't exist
              try {
                await initializePlaybackProgress(media.id);
              } catch (error) {
                console.log('Failed to initialize progress, continuing anyway:', error);
              }

              // Load saved progress or use provided start time
              try {
                const savedProgress = await getPlaybackProgress(media.id);
                const resumeTimeValue = startTime > 0 ? startTime : (savedProgress?.position || 0);
                console.log('Resume time calculation:', { startTime, savedPosition: savedProgress?.position, resumeTimeValue });

                // Only auto-seek on initial load, not on resume from pause
                if (startTime > 0 && video.currentTime === 0) {
                  // Only seek if this is the initial load with a specific start time
                  video.currentTime = startTime;
                  setCurrentTime(startTime);
                  setResumeTime(startTime);
                  console.log(`Started at provided time: ${startTime} seconds`);
                } else if (resumeTimeValue > 30 && videoDuration > 60 && resumeTimeValue < videoDuration - 30 && video.currentTime === 0) {
                  // Only auto-resume on initial load, not when resuming from pause
                  video.currentTime = resumeTimeValue;
                  setCurrentTime(resumeTimeValue);
                  setResumeTime(resumeTimeValue);
                  console.log(`Auto-resumed from saved position: ${resumeTimeValue} seconds`);
                } else {
                  console.log('No auto-seeking - continuing from current position:', video.currentTime);
                }
              } catch (error) {
                console.log('No saved progress found or error loading progress:', error);
                if (startTime > 0 && video.currentTime === 0) {
                  // Only seek to start time on initial load
                  video.currentTime = startTime;
                  setCurrentTime(startTime);
                  setResumeTime(startTime);
                  console.log(`Started at provided time (no saved progress): ${startTime} seconds`);
                }
              }
            }}
            onLoadedData={() => {
              console.log('Video loaded successfully');
              setIsLoading(false);
              const video = videoRef.current;
              if (video && video.readyState >= 2) {
                video.volume = volume;
                video.muted = false; // Always unmuted for video player
                setIsMuted(false);

                // Only seek to resume time on initial load, not when resuming from pause
                if (resumeTime > 0 && video.currentTime === 0 && Math.abs(video.currentTime - resumeTime) > 5) {
                  console.log(`Seeking to resume time ${resumeTime} after initial video load`);
                  video.currentTime = resumeTime;
                  setCurrentTime(resumeTime);
                } else {
                  console.log('Skipping resume time seek - continuing from current position:', video.currentTime);
                }
              }
            }}
            onTimeUpdate={() => {
              const video = videoRef.current;
              if (!video || isCasting) return;

              setCurrentTime(video.currentTime);

              // Update duration if it becomes available during playback
              if ((!duration || duration === 0) && video.duration && video.duration > 0 && isFinite(video.duration)) {
                console.log('Duration became available during playback:', video.duration);
                setDuration(video.duration);
              }

              // Also check seekable range for better duration detection
              if ((!duration || duration === 0) && video.seekable && video.seekable.length > 0) {
                const seekableEnd = video.seekable.end(video.seekable.length - 1);
                if (seekableEnd > duration) {
                  console.log('Updated duration from seekable range:', seekableEnd);
                  setDuration(seekableEnd);
                }
              }
            }}
            onSeeking={() => {
              console.log('Video seeking started');
              setIsBuffering(true);
            }}

            onSeeked={() => {
              console.log('Video seeking completed');
              setIsBuffering(false);
              const video = videoRef.current;
              if (video) {
                setCurrentTime(video.currentTime);
              }
            }}
            onWaiting={() => {
              console.log('Video is buffering');
              setIsBuffering(true);
            }}
            onCanPlayThrough={() => {
              console.log('Video can play through without buffering');
              setIsBuffering(false);
              setIsLoading(false);
            }}
            preload="auto"
            muted={false}
            crossOrigin="anonymous"
          >

            {/* Subtitles */}
            {availableSubtitles.map((subtitle, index) => (
              <track
                key={index}
                kind="subtitles"
                src={subtitle.url}
                srcLang={subtitle.language.toLowerCase()}
                label={subtitle.language}
                default={index === 0 && subtitlesEnabled}
              />
            ))}

            {/* Fallback message */}
            <p className="text-white text-center p-8">
              Your browser does not support the video tag or this video format.
              <br />
              <a
                href={getStreamUrl(media.id)}
                download={media.title}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Download the video file
              </a>
            </p>
          </video>

          {/* Loading/Buffering Overlay */}
          <AnimatePresence>
            {(isLoading || isBuffering) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-40"
              >
                <RedLoader size="large" />
              </motion.div>
            )}
          </AnimatePresence>

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
                    {/* Cast Button */}
                    <CastButton
                      isAvailable={castState.isAvailable}
                      isConnected={castState.isConnected}
                      isConnecting={castState.isConnecting}
                      deviceName={castState.deviceName}
                      onClick={handleCastClick}
                      className="p-3 bg-black/50 rounded-full hover:bg-black/70 border border-white/20 hover:border-blue-500/50 transition-all"
                    />

                    <button
                      onClick={handleClose}
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
                      className="progress-container relative w-full h-1 bg-white/30 rounded-lg cursor-pointer group-hover:h-2 transition-all duration-200 my-1 overflow-hidden"
                      onClick={(e) => {
                        // Only handle click if not dragging

                        if (!isDragging) {
                          handleProgressClick(e);
                        }
                      }}
                      onMouseDown={handleSeekStart}
                      onTouchStart={handleSeekStart}
                    >
                      {/* Buffered Progress */}
                      <div
                        className="absolute top-0 left-0 h-full bg-white/20 rounded-lg pointer-events-none"
                        style={{
                          width: videoRef.current?.buffered && videoRef.current.buffered.length > 0 && duration > 0
                            ? `${(videoRef.current.buffered.end(videoRef.current.buffered.length - 1) / duration) * 100}%`
                            : '0%'
                        }}
                      />

                      {/* Progress Fill */}
                      <div
                        className={`absolute top-0 left-0 h-full bg-red-600 rounded-lg transition-all pointer-events-none ${isDragging ? 'duration-0' : 'duration-200'
                          }`}
                        style={{
                          width: `${(() => {
                            if (isCasting && castState.isConnected) {
                              return castState.duration > 0 ? (castState.currentTime / castState.duration) * 100 : 0;
                            }

                            // For local video
                            if (duration > 0) {
                              return Math.min((currentTime / duration) * 100, 100);
                            }

                            // For videos without duration, use seekable range
                            const video = videoRef.current;
                            if (video && video.seekable && video.seekable.length > 0) {
                              const seekableEnd = video.seekable.end(video.seekable.length - 1);
                              return seekableEnd > 0 ? Math.min((currentTime / seekableEnd) * 100, 100) : 0;
                            }

                            // Fallback: no progress without duration
                            return 0;
                          })()}%`
                        }}
                      />

                      {/* Progress Handle */}
                      <div
                        className={`absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-red-600 rounded-full transition-all duration-200 pointer-events-none ${isDragging || isBuffering ? 'opacity-100 scale-125' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        style={{
                          left: `${(() => {
                            if (isCasting && castState.isConnected) {
                              return castState.duration > 0 ? (castState.currentTime / castState.duration) * 100 : 0;
                            }

                            // For local video
                            if (duration > 0) {
                              return Math.min((currentTime / duration) * 100, 100);
                            }

                            // For videos without duration, use seekable range
                            const video = videoRef.current;
                            if (video && video.seekable && video.seekable.length > 0) {
                              const seekableEnd = video.seekable.end(video.seekable.length - 1);
                              return seekableEnd > 0 ? Math.min((currentTime / seekableEnd) * 100, 100) : 0;
                            }

                            // Fallback: no progress without duration
                            return 0;
                          })()}%`
                        }}
                      />

                      {/* Buffering indicator */}
                      {isBuffering && (
                        <div
                          className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 border-2 border-white/30 border-t-red-600 rounded-full animate-spin pointer-events-none"
                          style={{
                            left: `${(() => {
                              if (duration > 0) {
                                return Math.min((currentTime / duration) * 100, 100);
                              }

                              const video = videoRef.current;
                              if (video && video.seekable && video.seekable.length > 0) {
                                const seekableEnd = video.seekable.end(video.seekable.length - 1);
                                return seekableEnd > 0 ? Math.min((currentTime / seekableEnd) * 100, 100) : 0;
                              }

                              return currentTime > 0 ? Math.min((currentTime / 300) * 100, 75) : 0;
                            })()}%`
                          }}
                        />
                      )}
                    </div>

                    {/* Time tooltip on hover */}
                    <div className="relative">
                      <div className="absolute bottom-2 left-0 right-0 pointer-events-none">
                        <div
                          className={`absolute bg-black/80 text-white text-xs px-2 py-1 rounded transition-opacity duration-200 transform -translate-x-1/2 ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          style={{
                            left: `${(() => {
                              if (isCasting && castState.isConnected) {
                                return castState.duration > 0 ? (castState.currentTime / castState.duration) * 100 : 0;
                              }

                              if (duration > 0) {
                                return Math.min((currentTime / duration) * 100, 100);
                              }

                              const video = videoRef.current;
                              if (video && video.seekable && video.seekable.length > 0) {
                                const seekableEnd = video.seekable.end(video.seekable.length - 1);
                                return seekableEnd > 0 ? Math.min((currentTime / seekableEnd) * 100, 100) : 0;
                              }

                              return currentTime > 0 ? Math.min((currentTime / 300) * 100, 75) : 0;
                            })()}%`
                          }}
                        >
                          {formatTime(isCasting && castState.isConnected ? castState.currentTime : currentTime)}
                        </div>
                      </div>
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
                        {(isCasting && castState.isConnected ? castState.playerState === 'PLAYING' : isPlaying) ? (
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

                      <div className="flex items-center gap-4">
                        <button
                          onClick={toggleMute}
                          className="text-white hover:text-white/70 transition-colors"
                          title={isMuted ? "Unmute (m)" : "Mute (m)"}
                        >
                          {(isCasting && castState.isConnected ? castState.isMuted : isMuted) ? (
                            <VolumeX className="w-6 h-6" />
                          ) : (
                            <Volume2 className="w-6 h-6" />
                          )}
                        </button>

                        {/* Volume Slider */}
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={(isCasting && castState.isConnected ? castState.isMuted : isMuted) ? 0 : (isCasting && castState.isConnected ? castState.volumeLevel : volume) * 100}
                            onChange={handleVolumeChange}
                            className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                            style={{
                              background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${isMuted ? 0 : volume * 100}%, rgba(255,255,255,0.3) ${isMuted ? 0 : volume * 100}%, rgba(255,255,255,0.3) 100%)`,
                              WebkitAppearance: 'none',
                              appearance: 'none'
                            }}
                          />
                          <style jsx>{`
                          input[type="range"]::-webkit-slider-thumb {
                            appearance: none;
                            width: 12px;
                            height: 12px;
                            border-radius: 50%;
                            background: #ef4444;
                            cursor: pointer;
                            border: none;
                          }
                          input[type="range"]::-moz-range-thumb {
                            width: 12px;
                            height: 12px;
                            border-radius: 50%;
                            background: #ef4444;
                            cursor: pointer;
                            border: none;
                          }
                        `}</style>
                        </div>

                        <button
                          onClick={toggleSubtitles}
                          className={`text-white hover:text-white/70 transition-colors ${subtitlesEnabled ? 'text-blue-400' : ''
                            }`}
                          title={subtitlesEnabled ? "Disable Subtitles (c)" : "Enable Subtitles (c)"}
                        >
                          <Subtitles className="w-6 h-6" />
                        </button>

                        <span className="text-white text-sm">
                          {formatTime(isCasting && castState.isConnected ? castState.currentTime : currentTime)} / {duration > 0 ? formatTime(isCasting && castState.isConnected ? castState.duration : duration) : 'Live'}
                        </span>

                        {/* Cast status indicator */}
                        {isCasting && castState.isConnected && (
                          <div className="flex items-center gap-2 text-blue-400 text-sm">
                            <Tv className="w-4 h-4" />
                            <span>Casting to {castState.deviceName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Cast Button in bottom controls */}
                      <CastButton
                        isAvailable={castState.isAvailable}
                        isConnected={castState.isConnected}
                        isConnecting={castState.isConnecting}
                        deviceName={castState.deviceName}
                        onClick={handleCastClick}
                        className=""
                      />

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

          {/* Resume Playback Notification */}
          <AnimatePresence>
            {showResumeNotification && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-30"
              >
                <div className="bg-black/90 backdrop-blur-sm text-white p-4 rounded-lg border border-white/20 flex items-center gap-4 min-w-96">
                  <div className="flex-1">
                    <p className="text-sm text-white/80 mb-1">Continue watching</p>
                    <p className="font-medium">Resume from {formatTime(resumeTime)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleStartFromBeginning}
                      className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 rounded transition-colors"
                    >
                      Start Over
                    </button>
                    <button
                      onClick={handleResumePlayback}
                      className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded transition-colors"
                    >
                      Resume
                    </button>
                  </div>
                  <button
                    onClick={() => setShowResumeNotification(false)}
                    className="text-white/60 hover:text-white/80 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
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
      )}
      {showPauseScreen && !isLoading && !isBuffering && !isCasting && (
        <motion.div
          key="netflix-pause-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Pause screen clicked - attempting to resume');
            const video = videoRef.current;
            if (video && video.paused) {
              console.log('Video is paused, resuming from current position:', video.currentTime);
              // Just resume playback from current position - no seeking
              video.play().then(() => {
                console.log('Video resumed successfully from position:', video.currentTime);
              }).catch(error => {
                console.error('Failed to resume video:', error);
              });
            } else {
              console.log('Video state:', {
                exists: !!video,
                paused: video?.paused,
                currentTime: video?.currentTime,
                readyState: video?.readyState
              });
            }
          }}
        >
          {/* Content Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="max-w-4xl w-full px-8 flex justify-between items-start gap-8"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {/* Left Content */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex-1 text-left max-w-2xl"
            >
              {/* Title */}
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="text-5xl md:text-6xl font-bold text-[#C0392B] mb-6 leading-tight drop-shadow-lg"
              >
                {media.title}
              </motion.h1>

              {/* Year, Rating and Type Info */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="flex items-center justify-start gap-3 mb-8 text-white/80 flex-wrap"
              >
                {media.year && (
                  <>
                    <span className="text-xl font-semibold">{media.year}</span>
                    <span className="w-1.5 h-1.5 bg-white/60 rounded-full"></span>
                  </>
                )}
                {media.type === 'episode' && (
                  <>
                    <span className="text-xl font-semibold">
                      S{String(media.season_number).padStart(2, '0')}E{String(media.episode_number).padStart(2, '0')}
                    </span>
                    <span className="w-1.5 h-1.5 bg-white/60 rounded-full"></span>
                  </>
                )}
                {media.rating && (
                  <span className="text-xl font-semibold text-yellow-500">{media.rating.toFixed(1)}</span>
                )}
                {media.genre_names && (
                  <span className="text-xl font-semibold text-white/80">{media.genre_names?.[0]}</span>
                )}
              </motion.div>

              {/* Description */}
              {media.description && (
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  transition={{ delay: 0.25, duration: 0.3 }}
                  className="text-lg text-white/75 mb-8 line-clamp-4 leading-relaxed"
                >
                  {media.description}
                </motion.p>
              )}

              {/* Progress Bar */}
              {duration > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                  className="w-full h-1 bg-white/20 rounded-full mb-8"
                >
                  <motion.div
                    className="h-full bg-[#C0392B] rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(currentTime / duration) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </motion.div>
              )}

              {/* Time Info */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="text-white/60 text-sm"
              >
                <p className="font-medium">
                  {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : 'Live'}
                </p>
              </motion.div>
            </motion.div>

            {/* Right Play Icon */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="flex-shrink-0 flex justify-center"
            >
              <motion.div 
                className="bg-[#C0392B]/20 rounded-full p-6 backdrop-blur-sm hover:bg-[#C0392B]/30 transition-colors duration-200 cursor-pointer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Play button clicked');
                  const video = videoRef.current;
                  if (video && video.paused) {
                    console.log('Resuming video from play button at position:', video.currentTime);
                    // Just resume playback, don't change any state that might cause remount
                    video.play().then(() => {
                      console.log('Video resumed from play button successfully');
                    }).catch(error => {
                      console.error('Failed to resume video from play button:', error);
                    });
                  }
                }}
              >
                <Play className="w-16 h-16 fill-current text-[#C0392B]" />
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Close Button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            onClick={(e) => {
              e.stopPropagation();
              console.log('Close button clicked from pause screen');
              handleClose();
            }}
            className="absolute top-6 right-6 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-all duration-200 hover:scale-110 border border-white/20 hover:border-red-500/50"
            title="Close Player (Esc)"
          >
            <X className="w-5 h-5" />
          </motion.button>

          {/* Resume Hint */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ delay: 0.35, duration: 0.3 }}
            className="absolute bottom-12 text-white/50 text-sm text-center"
          >
            <p>Click anywhere or press <span className="font-semibold text-white/70">SPACE</span> to resume</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VideoPlayer;
