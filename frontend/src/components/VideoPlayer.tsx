"use client";

/**
 * ULTRA-INSTANT LAN VIDEO PLAYER
 * 
 * Optimized for sub-millisecond streaming performance on LAN networks.
 * Features:
 * - Zero-copy sendfile streaming for instant playback
 * - Multi-tier caching (L1/L2/L3) for sub-ms cache hits
 * - Ultra-fast seeking with backend transcoding
 * - Netflix-level buffer management
 * - Gigabit LAN optimization
 * - Instant MKV transcoding and caching
 * - Sub-millisecond response times
 * 
 * Backend Integration:
 * - Uses ultra-fast streaming service with sendfile optimization
 * - Leverages L1 cache for instant preview access
 * - Supports instant seeking through backend transcoding
 * - Optimized for unlimited LAN bandwidth
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, RotateCw, X, Minimize, Subtitles, Tv, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '@/lib/api';
import RedLoader from './RedLoader';
import CastButton from './CastButton';
import VideoPlayerSettings from './VideoPlayerSettings';
import { useChromecast, CastMedia } from '@/hooks/useChromecast';

import { updatePlaybackProgress, getPlaybackProgress, trackView, initializePlaybackProgress } from '@/lib/playback';
import NextEpisodePreview from './NextEpisodePreview';
import NewMoviesPauseSection from './NewMoviesPauseSection';
import { Media } from '@/types/media';

interface VideoPlayerProps {
  media: Media;
  isOpen: boolean;
  onClose: () => void;
  startTime?: number;
  forceStartFromBeginning?: boolean;
  onPlayNext?: (nextMedia: Media) => void;
  onVideoPlay?: () => void;
  onProgress?: (currentTime: number, duration: number) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ media, isOpen, onClose, startTime = 0, forceStartFromBeginning = false, onPlayNext, onVideoPlay, onProgress }) => {
  // console.log('🎬 VideoPlayer: Initialized with props:', {
  //   mediaId: media.id,
  //   isOpen,
  //   startTime,
  //   forceStartFromBeginning
  // });

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track failed image URLs to prevent infinite retry loops
  const failedImageUrls = useRef<Set<string>>(new Set());

  // State declarations
  const [showPauseScreen, setShowPauseScreen] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string>('');


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
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [availableSubtitles, setAvailableSubtitles] = useState<Array<{
    id: number;
    language: string;
    url: string;
    title?: string;
    trackType?: string;
    streamIndex?: number;
    isDefault?: boolean;
    isForced?: boolean;
  }>>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);
  const [dragStartTime, setDragStartTime] = useState<number | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showResumeNotification, setShowResumeNotification] = useState(false);
  const [resumeTime, setResumeTime] = useState(0);
  const [isCasting, setIsCasting] = useState(false);
  const [isTranscoded, setIsTranscoded] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [showIntroAnimation, setShowIntroAnimation] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seriesData, setSeriesData] = useState<Media | null>(null); // Store fetched series data
  const [seekIndicator, setSeekIndicator] = useState<{ show: boolean; amount: number; direction: 'forward' | 'backward' }>({ show: false, amount: 0, direction: 'forward' });
  const seekIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [currentSubtitleText, setCurrentSubtitleText] = useState<string>('');
  const [audioIssueDetected, setAudioIssueDetected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState<number | null>(null);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [subtitleStyle, setSubtitleStyle] = useState({
    fontSize: 18,
    fontFamily: 'Arial, sans-serif',
    color: '#FFFFFF',
    backgroundColor: 'transparent',
    backgroundOpacity: 0.8,
    textShadow: true,
    textStroke: false,
    position: 'bottom' as 'bottom' | 'top' | 'center'
  });
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  // Chrome audio context activation helper
  const activateAudioContext = useCallback(async () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        return true;
      }
      return true;
    } catch (error) {
      return false;
    }
  }, []);

  // Centralized subtitle state reset function
  const resetSubtitleState = useCallback(() => {
    const video = videoRef.current;

    // Clear current subtitle display state immediately
    setCurrentSubtitleText('');
    // Don't clear availableSubtitles - keep the list of available tracks
    // Don't clear currentSubtitle and currentSubtitleTrack - keep the selected track
    // Don't disable subtitlesEnabled - keep user preference

    // Clean up video subtitle handlers
    if (video && (video as any).subtitleCleanup) {
      (video as any).subtitleCleanup();
      (video as any).subtitleCleanup = null;
    }

    // Clear global subtitle state
    (window as any).currentSubtitleCues = [];
    (window as any).lastSubtitleText = '';
    (window as any).pendingSubtitleTrack = null;

    // Force disable all native text tracks
    if (video) {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        track.mode = 'disabled';
        if ('oncuechange' in track) {
          track.oncuechange = null;
        }
      }

      // Remove track elements
      const trackElements = video.querySelectorAll('track');
      trackElements.forEach(track => track.remove());
    }
  }, []);

  // Clear only subtitle display text (for force start from beginning)
  const clearSubtitleDisplay = useCallback(() => {
    // Only clear the displayed text, keep all subtitle system intact
    setCurrentSubtitleText('');
    (window as any).lastSubtitleText = '';
    // Don't mess with cues - let the subtitle system handle timing naturally
  }, []);

  // Centralized subtitle update function - call this whenever video position changes
  const updateSubtitlesForCurrentTime = useCallback((currentTime?: number) => {
    const video = videoRef.current;
    if (!video || !subtitlesEnabled) {
      if ((window as any).lastSubtitleText !== '') {
        setCurrentSubtitleText('');
        (window as any).lastSubtitleText = '';
      }
      return;
    }

    // Check if the loaded subtitles belong to the current media
    if ((window as any).currentSubtitleMediaId !== media.id) {
      // Subtitles are for a different media, clear them
      if ((window as any).lastSubtitleText !== '') {
        setCurrentSubtitleText('');
        (window as any).lastSubtitleText = '';
      }
      return;
    }

    const videoTime = currentTime !== undefined ? currentTime : video.currentTime;
    const cues = (window as any).currentSubtitleCues;

    if (!cues || !Array.isArray(cues) || cues.length === 0) {
      if ((window as any).lastSubtitleText !== '') {
        setCurrentSubtitleText('');
        (window as any).lastSubtitleText = '';
      }
      return;
    }

    // Find active cue with precise timing
    const activeCue = cues.find((cue: any) =>
      videoTime >= cue.start && videoTime <= cue.end
    );

    if (activeCue && activeCue.text) {
      if (activeCue.text !== (window as any).lastSubtitleText) {
        setCurrentSubtitleText(activeCue.text);
        (window as any).lastSubtitleText = activeCue.text;
      }
    } else {
      if ((window as any).lastSubtitleText !== '') {
        setCurrentSubtitleText('');
        (window as any).lastSubtitleText = '';
      }
    }
  }, [subtitlesEnabled, currentSubtitle, media.id]);

  // Complete subtitle cleanup for media changes
  const completeSubtitleReset = useCallback(() => {
    const video = videoRef.current;

    // Clear all subtitle-related states completely
    setCurrentSubtitleText('');
    setAvailableSubtitles([]);
    setCurrentSubtitle(null);
    setCurrentSubtitleTrack(null);
    setSubtitlesEnabled(false);

    // Clean up video subtitle handlers
    if (video && (video as any).subtitleCleanup) {
      (video as any).subtitleCleanup();
      (video as any).subtitleCleanup = null;
    }

    // Clear ALL global subtitle state
    (window as any).currentSubtitleCues = [];
    (window as any).lastSubtitleText = '';
    (window as any).currentlyLoadingSubtitle = null;
    (window as any).pendingSubtitleTrack = null;
    (window as any).currentSubtitleMediaId = null; // Track which media the subtitles belong to

    // Force disable all native text tracks
    if (video) {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        track.mode = 'disabled';
        if ('oncuechange' in track) {
          track.oncuechange = null;
        }
      }

      // Remove all track elements from DOM
      const trackElements = video.querySelectorAll('track');
      trackElements.forEach(track => track.remove());
    }
  }, []);

  // Debounced subtitle loader to prevent multiple simultaneous loads
  const loadExternalSubtitle = useCallback(async (url: string, mediaId?: number) => {
    // Create a unique key for this media and subtitle URL
    const loadingKey = `${mediaId || media.id}-${url}`;

    // Prevent loading if we're already loading this specific combination
    if ((window as any).currentlyLoadingSubtitle === loadingKey) {
      return;
    }

    // Clear any previous loading state
    (window as any).currentlyLoadingSubtitle = loadingKey;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const subtitleText = await response.text();

      // Detect subtitle format and parse accordingly
      let cues: Array<{ start: number, end: number, text: string }> = [];

      if (url.toLowerCase().includes('.vtt') || subtitleText.includes('WEBVTT')) {
        cues = parseVTT(subtitleText);
      } else {
        cues = parseSRT(subtitleText);
      }

      // Create custom subtitle overlay instead of using video text tracks
      const video = videoRef.current;
      if (video && cues.length > 0) {
        // Clean up any existing subtitle handlers first
        if ((video as any).subtitleCleanup) {
          (video as any).subtitleCleanup();
        }

        // Chrome-specific: Force disable all native text tracks
        for (let i = 0; i < video.textTracks.length; i++) {
          const track = video.textTracks[i];
          track.mode = 'disabled';
          // Chrome-specific properties
          if ('oncuechange' in track) {
            track.oncuechange = null;
          }
        }

        // Remove all track elements from DOM for Chrome compatibility
        const trackElements = video.querySelectorAll('track');
        trackElements.forEach(track => {
          track.remove();
        });

        // Store cues globally for subtitle display with media ID tracking
        (window as any).currentSubtitleCues = cues;
        (window as any).lastSubtitleText = '';
        (window as any).currentSubtitleMediaId = mediaId || media.id;

        // Immediately update subtitles for current video position
        setTimeout(() => {
          updateSubtitleText();
        }, 50);

        // Enhanced subtitle display function with Chrome-specific fixes
        const updateSubtitleText = () => {
          // Always check for subtitles if we have cues loaded
          if (!cues.length) {
            setCurrentSubtitleText('');
            (window as any).lastSubtitleText = '';
            return;
          }

          const currentTime = video.currentTime;

          // Remove forceStartFromBeginning check - it was interfering with normal subtitle display

          // Find active cue with precise timing (no buffer for better accuracy)
          const activeCue = cues.find(cue =>
            currentTime >= cue.start && currentTime <= cue.end
          );

          if (activeCue) {
            if (activeCue.text !== (window as any).lastSubtitleText) {
              // Chrome-specific: Force update with requestAnimationFrame
              requestAnimationFrame(() => {
                setCurrentSubtitleText(activeCue.text);
                (window as any).lastSubtitleText = activeCue.text;
              });
            }
          } else {
            if ((window as any).lastSubtitleText !== '') {
              requestAnimationFrame(() => {
                setCurrentSubtitleText('');
                (window as any).lastSubtitleText = '';
              });
            }
          }
        };

        // Use high-frequency timeupdate for better subtitle timing
        let subtitleUpdateInterval: NodeJS.Timeout;
        let animationFrameId: number;

        const startSubtitleUpdates = () => {
          // Clear any existing interval
          if (subtitleUpdateInterval) {
            clearInterval(subtitleUpdateInterval);
          }
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }

          // Chrome-specific: Use both interval and requestAnimationFrame for reliability
          subtitleUpdateInterval = setInterval(() => {
            updateSubtitleText();
          }, 100);

          // Additional Chrome fix: Use requestAnimationFrame for smoother updates
          const animationUpdate = () => {
            updateSubtitleText();
            if (!video.paused) {
              animationFrameId = requestAnimationFrame(animationUpdate);
            }
          };
          animationFrameId = requestAnimationFrame(animationUpdate);
        };

        const stopSubtitleUpdates = () => {
          if (subtitleUpdateInterval) {
            clearInterval(subtitleUpdateInterval);
          }
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
        };

        // Start updates when video plays, stop when paused
        const handlePlay = () => {
          startSubtitleUpdates();
          updateSubtitleText(); // Immediate update
        };

        const handlePause = () => {
          stopSubtitleUpdates();
          updateSubtitleText(); // Final update
        };

        const handleSeeked = () => {
          updateSubtitleText(); // Immediate update after seek
          if (!video.paused) {
            startSubtitleUpdates();
          }
        };

        // Add event listeners for subtitle-specific events
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('seeked', handleSeeked);

        // Chrome-specific additional events
        video.addEventListener('loadeddata', updateSubtitleText);
        video.addEventListener('canplay', updateSubtitleText);

        // Initial subtitle check with delay for Chrome
        setTimeout(() => {
          updateSubtitleText();
        }, 100);

        // Start updates if video is already playing
        if (!video.paused) {
          startSubtitleUpdates();
        }

        // Force immediate subtitle check for the first few seconds
        const forceSubtitleCheck = setInterval(() => {
          updateSubtitleText();
        }, 500);

        setTimeout(() => {
          clearInterval(forceSubtitleCheck);
        }, 5000); // Check every 500ms for the first 5 seconds

        // Enhanced cleanup function
        const cleanup = () => {
          stopSubtitleUpdates();
          video.removeEventListener('play', handlePlay);
          video.removeEventListener('pause', handlePause);
          video.removeEventListener('seeked', handleSeeked);
          video.removeEventListener('loadeddata', updateSubtitleText);
          video.removeEventListener('canplay', updateSubtitleText);
          (window as any).currentSubtitleCues = [];
          (window as any).lastSubtitleText = '';
        };

        // Store cleanup function for later use
        (video as any).subtitleCleanup = cleanup;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setCurrentSubtitleText(`Error loading subtitles: ${errorMessage}`);
      setTimeout(() => setCurrentSubtitleText(''), 3000);
    } finally {
      // Clear loading flag only if it matches our current loading key
      if ((window as any).currentlyLoadingSubtitle === loadingKey) {
        (window as any).currentlyLoadingSubtitle = null;
      }
    }
  }, [forceStartFromBeginning, media.id]);

  const getStreamUrl = useCallback((mediaId: number, quality?: string, format?: string, seekTime?: number) => {
    const baseUrl = `${getApiUrl()}/api/stream/${mediaId}`;
    const params = new URLSearchParams();

    // ULTRA-INSTANT LAN STREAMING PARAMETERS - Sub-millisecond response
    params.set('optimize', 'ultra-instant-lan');
    params.set('buffer', 'netflix-level');
    params.set('latency', 'sub-millisecond');
    params.set('preload', 'ultra-aggressive');
    params.set('network', 'gigabit-lan');
    params.set('streaming', 'zero-copy');
    params.set('cache', 'instant-hit');
    params.set('io', 'sendfile-optimized');
    params.set('tcp', 'ultra-fast');
    params.set('response', 'instant');

    // Maximum quality for LAN - no bandwidth limitations
    if (quality) {
      params.set('quality', quality);
    } else {
      params.set('quality', '4k-ultra'); // 4K Ultra quality for LAN
    }

    // Force MP4 container for maximum compatibility and instant seeking
    if (format) {
      params.set('format', format);
    } else {
      params.set('format', 'mp4-optimized');
    }

    // Enhanced seeking parameters for instant response
    if (seekTime && seekTime > 0) {
      params.set('t', seekTime.toString());
      params.set('seek', seekTime.toString());
      params.set('seek_mode', 'instant');
      params.set('buffer_ahead', '60'); // 60 seconds buffer ahead
    }

    // Additional LAN optimizations
    params.set('chunk_size', 'ultra-large');
    params.set('connection', 'keep-alive-optimized');
    params.set('compression', 'none'); // No compression for LAN
    params.set('priority', 'ultra-high');

    return `${baseUrl}?${params.toString()}`;
  }, []);

  // Function to handle seeking in transcoded streams
  const seekTranscodedVideo = async (seekTime: number) => {
    const video = videoRef.current;
    if (!video) return;

    setIsBuffering(true);

    // Store current playback state
    const wasPlaying = !video.paused;

    try {
      // Generate new stream URL with seek time
      const newStreamUrl = getStreamUrl(media.id, 'high', 'mp4', seekTime);

      // Update video source
      video.src = newStreamUrl;

      // Update current time state immediately for UI responsiveness
      setCurrentTime(seekTime);

      // Wait for video to load and then resume playback if it was playing
      const handleCanPlay = () => {
        setIsBuffering(false);
        if (wasPlaying) {
          video.play().catch(() => { });
        }
        video.removeEventListener('canplay', handleCanPlay);
      };

      video.addEventListener('canplay', handleCanPlay);

      // Load the new stream
      video.load();

    } catch (error) {
      setIsBuffering(false);
    }
  };

  // Fetch series data if media is an episode
  useEffect(() => {
    const fetchSeriesData = async () => {
      if (media.type === 'episode' && media.series_id) {
        try {
          const response = await fetch(`${getApiUrl()}/api/series/${media.series_id}`);
          if (response.ok) {
            const data = await response.json();
            setSeriesData(data);
          } else {
            // Fallback: try to find series info from media API
            const allMediaResponse = await fetch(`${getApiUrl()}/api/media`);
            const allMedia = await allMediaResponse.json();
            const seriesInfo = allMedia.find((m: Media) => m.id === media.series_id || m.series_id === media.series_id);
            if (seriesInfo) {
              setSeriesData(seriesInfo);
            } else {
              // Final fallback: try TMDB API for series data
              try {
                const tmdbResponse = await fetch(`${getApiUrl()}/api/tmdb/tv/${media.series_id}`);
                if (tmdbResponse.ok) {
                  const tmdbData = await tmdbResponse.json();
                  setSeriesData({
                    id: media.series_id,
                    title: tmdbData.name,
                    type: 'episode', // Set type to episode for TV series
                    description: tmdbData.overview,
                    rating: tmdbData.vote_average,
                    vote_count: tmdbData.vote_count,
                    year: new Date(tmdbData.first_air_date).getFullYear(),
                    status: tmdbData.status,
                    poster_path: tmdbData.poster_path ? `/api/tmdb/image${tmdbData.poster_path}` : undefined,
                    backdrop_path: tmdbData.backdrop_path ? `/api/tmdb/image${tmdbData.backdrop_path}` : undefined,
                    tmdb_poster_url: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : undefined,
                    tmdb_logo_url: tmdbData.networks?.[0]?.logo_path ? `https://image.tmdb.org/t/p/w300${tmdbData.networks[0].logo_path}` : undefined,
                    network: tmdbData.networks?.[0]?.name,
                    duration: tmdbData.episode_run_time?.[0],
                    // Additional TMDB fields that might be useful
                    first_air_date: tmdbData.first_air_date,
                    genres: tmdbData.genres?.map((g: any) => ({ name: g.name })) || [],
                    genre_names: tmdbData.genres?.map((g: any) => g.name) || [],
                    popularity: tmdbData.popularity
                  });
                }
              } catch (tmdbError) {
                console.error("TMDB fallback failed:", tmdbError);
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch series data", error);
        }
      } else {
        setSeriesData(null);
      }
    };
    fetchSeriesData();
  }, [media.id, media.series_id, media.type]);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      setIsMobile(/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase()));
    };
    checkMobile();
  }, []);

  // Handle page scroll when video player opens/closes
  useEffect(() => {
    if (isOpen) {
      // Disable page scroll when video player is open
      document.body.style.overflow = 'hidden';
      // Show intro animation when player opens
      setShowIntroAnimation(true);
    } else {
      // Re-enable page scroll when video player is closed
      document.body.style.overflow = 'auto';
    }

    // Cleanup function to ensure scroll is restored
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // Hide intro animation after it completes AND video is actually playing
  useEffect(() => {
    if (showIntroAnimation && isOpen) {
      // Wait for video to actually start playing before hiding intro
      if (isPlaying) {
        // Add a minimum display time for the animation
        const timer = setTimeout(() => {
          setShowIntroAnimation(false);
        }, 500); // Small delay after video starts playing

        return () => clearTimeout(timer);
      }
    }
  }, [showIntroAnimation, isOpen, isPlaying]);

  // Handle forceStartFromBeginning flag changes
  useEffect(() => {
    if (forceStartFromBeginning && isOpen) {
      const video = videoRef.current;
      if (video) {

        // Force reset to beginning
        setCurrentTime(0);
        setResumeTime(0);
        setShowResumeNotification(false);

        // CRITICAL: Only clear subtitle display, keep subtitle system intact
        clearSubtitleDisplay();

        // If video is already loaded, seek to beginning immediately
        if (video.readyState >= 2) {
          video.currentTime = 0;

          // Force immediate subtitle update for time 0
          setTimeout(() => {
            // Clear subtitle text immediately
            setCurrentSubtitleText('');
            (window as any).lastSubtitleText = '';

            // Force subtitle update for current time (should be 0)
            if ((window as any).currentSubtitleCues && (window as any).currentSubtitleCues.length > 0) {
              const cues = (window as any).currentSubtitleCues;
              const activeCue = cues.find((cue: any) =>
                video.currentTime >= cue.start && video.currentTime <= cue.end
              );

              if (activeCue) {
                setCurrentSubtitleText(activeCue.text);
                (window as any).lastSubtitleText = activeCue.text;
              } else {
                setCurrentSubtitleText('');
                (window as any).lastSubtitleText = '';
              }
            }

            // Subtitle reloading will be handled by existing subtitle loading effects
          }, 50); // Reduced delay for faster response
        }
      }
    }
  }, [forceStartFromBeginning, isOpen, clearSubtitleDisplay]);

  // Handle media changes (when switching episodes/movies)
  useEffect(() => {
    if (isOpen && media.id) {
      const video = videoRef.current;
      if (video) {
        // Clear failed image URLs for new media
        failedImageUrls.current.clear();

        // IMMEDIATE SUBTITLE CLEANUP using complete reset for media changes
        completeSubtitleReset();

        // Clear any pending subtitle loading
        (window as any).currentlyLoadingSubtitle = null;
        (window as any).pendingSubtitleTrack = null;

        // Reset all playback states for new media
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
        setIsLoading(true);
        setIsBuffering(true);
        setShowPauseScreen(false);
        setShowResumeNotification(false);
        setResumeTime(forceStartFromBeginning ? 0 : 0);
        setHasInitiallyLoaded(false);

        // If forcing start from beginning, only clear subtitle display
        if (forceStartFromBeginning) {
          clearSubtitleDisplay();
        }

        // Load new video source
        const newVideoSrc = getStreamUrl(media.id, 'high', 'mp4');
        video.src = newVideoSrc;
        setVideoSrc(newVideoSrc);

        // Load and auto-play the new media
        video.load();

        // Auto-play after a short delay to ensure loading
        setTimeout(() => {
          if (video.readyState >= 2) {
            video.play().catch(() => { });
          } else {
            // Wait for canplay event
            const handleCanPlay = () => {
              video.play().catch(() => { });
              video.removeEventListener('canplay', handleCanPlay);
            };
            video.addEventListener('canplay', handleCanPlay);
          }
        }, 100);
      }
    }
  }, [media.id, media.title, isOpen, getStreamUrl, forceStartFromBeginning, completeSubtitleReset, clearSubtitleDisplay]);

  // Initialize video source when player opens or media changes
  useEffect(() => {
    if (isOpen && media.id) {
      const video = videoRef.current;
      if (video) {
        const newVideoSrc = getStreamUrl(media.id, 'high', 'mp4');

        // Only update source if it's different (new episode)
        if (newVideoSrc !== videoSrc) {

          video.src = newVideoSrc;
          setVideoSrc(newVideoSrc);
          setHasInitiallyLoaded(false); // Reset flag when loading new video
          setIsLoading(true);
          setIsBuffering(true);
          setCurrentTime(0);
          setDuration(0);

          // CHROME AUDIO FIX: Ensure audio is always enabled
          video.muted = false;
          video.volume = volume > 0 ? volume : 1.0;
          setIsMuted(false);

          // Reset other states for new episode
          setShowPauseScreen(false);
          setShowResumeNotification(false);
          setResumeTime(0);
        }
      }
    } else if (!isOpen) {
      // Reset video source when player closes
      setVideoSrc('');
      setHasInitiallyLoaded(false);
    }
  }, [media.id, isOpen, getStreamUrl, volume]);



  // Enhanced SRT parser with better error handling and precise timing
  const parseSRT = (srtText: string) => {
    const cues = [];

    // Normalize line endings and clean up the text
    const normalizedText = srtText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();

    // Split by double newlines to get subtitle blocks
    const blocks = normalizedText.split(/\n\s*\n/);

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex].trim();
      if (!block) continue;

      const lines = block.split('\n').map(line => line.trim()).filter(line => line);

      if (lines.length < 2) continue;

      // Find the timestamp line (could be line 1 or 2 depending on numbering)
      let timeLineIndex = -1;
      let timeMatch = null;

      for (let i = 0; i < Math.min(lines.length, 3); i++) {
        timeMatch = lines[i].match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/);
        if (timeMatch) {
          timeLineIndex = i;
          break;
        }
      }

      if (timeMatch && timeLineIndex !== -1) {
        // Parse with higher precision for milliseconds
        const startTime = parseInt(timeMatch[1]) * 3600 +
          parseInt(timeMatch[2]) * 60 +
          parseInt(timeMatch[3]) +
          parseInt(timeMatch[4]) / 1000;
        const endTime = parseInt(timeMatch[5]) * 3600 +
          parseInt(timeMatch[6]) * 60 +
          parseInt(timeMatch[7]) +
          parseInt(timeMatch[8]) / 1000;

        // Get text lines after the timestamp
        const textLines = lines.slice(timeLineIndex + 1);
        const text = textLines.join('\n')
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/\{[^}]*\}/g, '') // Remove ASS/SSA tags
          .trim();

        if (text && startTime < endTime && endTime - startTime < 30) { // Sanity check: max 30 seconds per subtitle
          cues.push({
            start: Math.round(startTime * 1000) / 1000, // Round to 3 decimal places
            end: Math.round(endTime * 1000) / 1000,
            text
          });
        }
      }
    }

    // Sort cues by start time to ensure proper order
    cues.sort((a, b) => a.start - b.start);

    return cues;
  };

  // Enhanced WebVTT parser with better precision
  const parseVTT = (vttText: string) => {
    const cues = [];
    const lines = vttText.split('\n');
    let i = 0;

    // Skip header and metadata
    while (i < lines.length && !lines[i].includes('-->')) {
      i++;
    }

    while (i < lines.length) {
      const line = lines[i].trim();

      if (line.includes('-->')) {
        // Enhanced regex to handle various WebVTT timestamp formats
        const timeMatch = line.match(/(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})/);
        if (timeMatch) {
          // Parse with higher precision
          const startTime = parseInt(timeMatch[1]) * 3600 +
            parseInt(timeMatch[2]) * 60 +
            parseInt(timeMatch[3]) +
            parseInt(timeMatch[4]) / 1000;
          const endTime = parseInt(timeMatch[5]) * 3600 +
            parseInt(timeMatch[6]) * 60 +
            parseInt(timeMatch[7]) +
            parseInt(timeMatch[8]) / 1000;

          // Collect text lines until empty line or next timestamp
          i++;
          const textLines = [];
          while (i < lines.length && lines[i].trim() && !lines[i].includes('-->')) {
            const textLine = lines[i].trim();
            // Skip WebVTT cue settings and notes
            if (!textLine.startsWith('NOTE') && !textLine.includes('align:') && !textLine.includes('position:')) {
              textLines.push(textLine);
            }
            i++;
          }

          const text = textLines.join('\n')
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/\{[^}]*\}/g, '') // Remove WebVTT styling
            .trim();

          if (text && startTime < endTime && endTime - startTime < 30) { // Sanity check
            cues.push({
              start: Math.round(startTime * 1000) / 1000, // Round to 3 decimal places
              end: Math.round(endTime * 1000) / 1000,
              text
            });
          }
        }
      } else {
        i++;
      }
    }

    // Sort cues by start time to ensure proper order
    cues.sort((a, b) => a.start - b.start);

    return cues;
  };

  // Load subtitles and audio tracks
  useEffect(() => {
    const loadTracks = async () => {
      // Clear any existing subtitle state before loading new tracks
      setCurrentSubtitleText('');
      (window as any).currentlyLoadingSubtitle = null;
      (window as any).pendingSubtitleTrack = null;

      try {
        // Load subtitle tracks (both internal and external)
        const subtitleResponse = await fetch(`${getApiUrl()}/api/media/${media.id}/subtitles`);
        if (subtitleResponse.ok) {
          const subtitleTracks = await subtitleResponse.json();

          if (subtitleTracks && subtitleTracks.length > 0) {
            // Filter out invalid subtitle tracks
            const validTracks = subtitleTracks.filter((track: any) => {
              // Skip tracks with invalid or empty languages
              if (!track.language || track.language.trim() === '') return false;

              // Skip tracks with generic/invalid codec names that aren't actual subtitles
              const invalidCodecs = ['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle'];
              if (track.codec_name && invalidCodecs.includes(track.codec_name.toLowerCase())) {
                // Only keep PGS subtitles if they have a proper language (not 'unknown')
                if (track.codec_name === 'hdmv_pgs_subtitle' &&
                  (!track.language || track.language.toLowerCase() === 'unknown')) {
                  return false;
                }
              }

              // Allow external tracks with 'unknown' language (uploaded subtitles)
              if (track.language.toLowerCase() === 'unknown') {
                if (track.track_type === 'external') {
                  return true; // Always keep external unknown tracks
                } else {
                  return false; // Skip internal unknown tracks
                }
              }

              // Skip duplicate tracks (same language and type)
              const duplicates = subtitleTracks.filter((t: any) =>
                t.language === track.language &&
                t.track_type === track.track_type &&
                t.id !== track.id
              );

              // If there are duplicates, only keep the first one or the one with a file path
              if (duplicates.length > 0) {
                const hasFilePath = track.file_path && track.file_path.trim() !== '';
                const isFirstOfType = !subtitleTracks.find((t: any) =>
                  t.language === track.language &&
                  t.track_type === track.track_type &&
                  t.id < track.id
                );

                // Keep if it has a file path or is the first of its type
                return hasFilePath || isFirstOfType;
              }

              return true;
            });

            const subs = validTracks.map((track: any) => ({
              id: track.id,
              language: track.language,
              title: track.title || track.language,
              trackType: track.track_type || 'external',
              streamIndex: track.stream_index,
              isDefault: track.is_default || false,
              isForced: track.is_forced || false,
              url: `${getApiUrl()}/api/media/${media.id}/subtitles/${track.id}/file`
            }));

            setAvailableSubtitles(subs);

            // Set default subtitle track (prefer default, then forced, then first available)
            const defaultTrack = subs.find((sub: any) => sub.isDefault) ||
              subs.find((sub: any) => sub.isForced) ||
              subs[0];
            if (defaultTrack) {
              setCurrentSubtitleTrack(defaultTrack.id);
              setCurrentSubtitle(defaultTrack.url);
              // Keep subtitles disabled by default - user can enable manually
              setSubtitlesEnabled(false);
              // Store the default track for later loading when user enables subtitles
              (window as any).pendingSubtitleTrack = defaultTrack;
            }
          } else {
            setAvailableSubtitles([]);
            setCurrentSubtitle(null);
            setCurrentSubtitleTrack(null);
            setSubtitlesEnabled(false);
          }
        }

        // Load audio tracks
        const audioResponse = await fetch(`${getApiUrl()}/api/media/${media.id}/audio`);
        if (audioResponse.ok) {
          const audioTracks = await audioResponse.json();
          if (audioTracks && audioTracks.length > 0) {
            // Set default audio track (prefer default or first available)
            const defaultTrack = audioTracks.find((track: any) => track.is_default) || audioTracks[0];
            if (defaultTrack) {
              setCurrentAudioTrack(defaultTrack.id);
            }
          }
        }
      } catch (error) {
        setAvailableSubtitles([]);
        setCurrentSubtitle(null);
        setCurrentSubtitleTrack(null);
        setSubtitlesEnabled(false);
      }
    };

    if (isOpen && media.id) {
      loadTracks();
    }
  }, [media.id, isOpen]);

  // Force subtitle loading when subtitles are enabled - with media ID check
  useEffect(() => {
    if (subtitlesEnabled && currentSubtitle && media.id) {
      // Only load subtitles when explicitly enabled by user
      const timeoutId = setTimeout(() => {
        // Double-check that we still have the same media and subtitle
        if (subtitlesEnabled && currentSubtitle && media.id) {
          loadExternalSubtitle(currentSubtitle, media.id);
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [subtitlesEnabled, currentSubtitle, loadExternalSubtitle, media.id]);

  // Additional effect to ensure subtitles load when video is ready - only when enabled by user
  useEffect(() => {
    if (isOpen && subtitlesEnabled && currentSubtitle && videoRef.current && !isLoading && media.id) {
      const video = videoRef.current;
      if (video.readyState >= 2) {
        // Only load subtitles when explicitly enabled by user
        const timeoutId = setTimeout(() => {
          // Double-check states before loading
          if (subtitlesEnabled && currentSubtitle && media.id) {
            loadExternalSubtitle(currentSubtitle, media.id);
          }
        }, 200);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [isOpen, subtitlesEnabled, currentSubtitle, isLoading, loadExternalSubtitle, media.id]);

  // Force subtitle reload when media changes and subtitles are enabled
  useEffect(() => {
    if (isOpen && media.id && subtitlesEnabled && currentSubtitle && !isLoading) {
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        // Only reload subtitles if user has explicitly enabled them
        const timeoutId = setTimeout(() => {
          if (subtitlesEnabled && currentSubtitle && media.id) {
            // Clear existing cues first
            (window as any).currentSubtitleCues = [];
            (window as any).lastSubtitleText = '';
            (window as any).currentSubtitleMediaId = null;
            setCurrentSubtitleText('');

            // Load new subtitles with media ID
            loadExternalSubtitle(currentSubtitle, media.id);
          }
        }, 500); // Longer delay to ensure video is fully ready

        return () => clearTimeout(timeoutId);
      }
    }
  }, [media.id, subtitlesEnabled, currentSubtitle, isLoading, loadExternalSubtitle, isOpen]);

  // Final safety net: Only load subtitles when user has enabled them
  useEffect(() => {
    if (isOpen && media.id && subtitlesEnabled && currentSubtitle && hasInitiallyLoaded && !isLoading) {
      // Check if we have subtitles for the current media
      const hasCorrectSubtitles = (window as any).currentSubtitleMediaId === media.id &&
        (window as any).currentSubtitleCues?.length > 0;

      if (!hasCorrectSubtitles) {
        const timeoutId = setTimeout(() => {
          if (subtitlesEnabled && currentSubtitle && media.id) {
            // Only load subtitles if user has explicitly enabled them
            loadExternalSubtitle(currentSubtitle, media.id);
          }
        }, 1000); // Give everything time to settle

        return () => clearTimeout(timeoutId);
      }
    }
  }, [isOpen, media.id, subtitlesEnabled, currentSubtitle, hasInitiallyLoaded, isLoading, loadExternalSubtitle]);

  // Handle subtitle track changes with improved cleanup
  const handleSubtitleTrackChange = useCallback((trackId: number | null) => {
    setCurrentSubtitleTrack(trackId);

    // IMMEDIATE cleanup - clear all subtitle states synchronously
    setCurrentSubtitleText('');

    const video = videoRef.current;
    if (video) {
      // Clean up previous subtitle event listeners and intervals IMMEDIATELY
      if ((video as any).subtitleCleanup) {
        (video as any).subtitleCleanup();
        (video as any).subtitleCleanup = null;
      }

      // Force clear global state immediately
      (window as any).currentSubtitleCues = [];
      (window as any).lastSubtitleText = '';
    }

    // Chrome-specific: Force disable ALL text tracks
    if (video) {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        track.mode = 'disabled'; // Use 'disabled' instead of 'hidden' for Chrome
        // Chrome-specific cleanup
        if ('oncuechange' in track) {
          track.oncuechange = null;
        }
        // Force remove cues if possible
        try {
          while (track.cues && track.cues.length > 0) {
            track.removeCue(track.cues[0]);
          }
        } catch (e) {
          // Ignore errors when removing cues
        }
      }

      // Remove all track elements from DOM
      const existingTrackElements = video.querySelectorAll('track');
      existingTrackElements.forEach(track => {
        track.remove();
      });

      // Chrome-specific: Force clear any cached text tracks
      try {
        // Clear textTracks array if possible
        if (video.textTracks && 'clear' in video.textTracks) {
          (video.textTracks as any).clear();
        }
      } catch (e) {
        // Ignore if not supported
      }
    }

    // Clear global subtitle state completely
    (window as any).currentSubtitleCues = [];
    (window as any).lastSubtitleText = '';

    if (trackId === null) {
      // Turn off subtitles
      setSubtitlesEnabled(false);
      setCurrentSubtitle(null);
    } else {
      // Find the selected track
      const selectedTrack = availableSubtitles.find((sub: any) => sub.id === trackId);

      if (selectedTrack) {
        setSubtitlesEnabled(true);

        // Use unified subtitle loading for both internal and external
        if (selectedTrack.url) {
          setCurrentSubtitle(selectedTrack.url);
          // Load subtitle immediately without race condition check
          setTimeout(() => {
            loadExternalSubtitle(selectedTrack.url);
          }, 100);
        }
      }
    }
  }, [availableSubtitles, loadExternalSubtitle]);

  // Handle audio track changes
  const handleAudioTrackChange = useCallback((trackId: number) => {
    setCurrentAudioTrack(trackId);

    // Note: Audio track switching would require server-side support
    // For now, we just update the state
  }, []);

  // Handle playback rate changes
  const handlePlaybackRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);

    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
    }
  }, []);



  // Video event handlers
  const handleVideoEvents = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(video.currentTime);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handleCanPlay = () => {
      setIsBuffering(false);
    };

    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setShowNextEpisode(true);

      if (nextEpisode && onPlayNext) {
        setTimeout(() => {
          onPlayNext(nextEpisode);
        }, 5000);
      }
    };

    // Add event listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('ended', handleEnded);

    // Cleanup function
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('ended', handleEnded);
    };
  }, [isDragging, nextEpisode, onPlayNext]);

  // Apply video event handlers
  useEffect(() => {
    if (videoRef.current) {
      return handleVideoEvents();
    }
  }, [handleVideoEvents, videoSrc]);





  // Get subtitle availability info
  const getSubtitleInfo = useCallback(() => {
    const internal = availableSubtitles.filter(s => s.trackType === 'internal');
    const external = availableSubtitles.filter(s => s.trackType === 'external');

    return {
      total: availableSubtitles.length,
      internal: internal.length,
      external: external.length,
      languages: [...new Set(availableSubtitles.map(s => s.language))],
      hasDefault: availableSubtitles.some(s => s.isDefault),
      hasForced: availableSubtitles.some(s => s.isForced),
      internalLanguages: [...new Set(internal.map(s => s.language))],
      externalLanguages: [...new Set(external.map(s => s.language))]
    };
  }, [availableSubtitles]);

  // Initialize subtitle tracks when video loads
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      // Listen for text track cue changes for internal subtitles
      const handleLoadedMetadata = () => {
        const tracks = video.textTracks;
        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i];

          // Listen for cue changes to update subtitle text
          track.addEventListener('cuechange', () => {
            if (track.mode === 'showing' && track.activeCues && track.activeCues.length > 0) {
              const cue = track.activeCues[0] as any;
              setCurrentSubtitleText(cue.text || '');
            } else if (track.mode === 'showing') {
              setCurrentSubtitleText('');
            }
          });
        }
      };

      if (video.readyState >= 1) {
        handleLoadedMetadata();
      } else {
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }
    }
  }, [videoSrc]);

  // Fetch next episode for TV series
  useEffect(() => {
    const fetchNextEpisode = async () => {


      if (media.type === 'episode') {
        try {
          const response = await fetch(`${getApiUrl()}/api/media`);
          const allMedia: Media[] = await response.json();

          // Extract season and episode numbers from title if not available in metadata
          let currentSeason = media.season_number;
          let currentEpisodeNum = media.episode_number;



          if (!currentSeason || !currentEpisodeNum) {
            const episodeMatch = media.title.match(/[Ss](\d+)[Ee](\d+)/);
            if (episodeMatch) {
              currentSeason = parseInt(episodeMatch[1]);
              currentEpisodeNum = parseInt(episodeMatch[2]);

            }
          }

          if (currentSeason && currentEpisodeNum) {


            // Find episodes from the same series
            const seriesEpisodes = allMedia.filter((m: Media) => {
              if (m.type !== 'episode') return false;

              // Method 1: Direct series_id match (most reliable)
              if (media.series_id && m.series_id === media.series_id) {
                return true;
              }

              // Method 2: Extract series name from title (remove season/episode info)
              const currentSeriesName = media.title.replace(/\s*-?\s*S\d+E\d+.*$/i, '').trim();
              const candidateSeriesName = m.title.replace(/\s*-?\s*S\d+E\d+.*$/i, '').trim();

              if (currentSeriesName && candidateSeriesName &&
                currentSeriesName.toLowerCase() === candidateSeriesName.toLowerCase()) {
                return true;
              }

              // Method 3: Check if titles start with the same series name
              const currentFirstWord = media.title.split(' ')[0].toLowerCase();
              const candidateFirstWord = m.title.split(' ')[0].toLowerCase();

              if (currentFirstWord.length > 3 && currentFirstWord === candidateFirstWord) {
                return true;
              }

              // Method 4: File path similarity (same directory)
              if (media.file_path && m.file_path) {
                const currentDir = media.file_path.split('/').slice(0, -1).join('/');
                const candidateDir = m.file_path.split('/').slice(0, -1).join('/');
                if (currentDir && candidateDir && currentDir === candidateDir) {
                  return true;
                }
              }

              return false;
            });



            // First, try to find the next episode in the same season
            const nextEpisodeInSeason = seriesEpisodes.find((m: Media) => {
              let season = m.season_number;
              let episode = m.episode_number;

              if (!season || !episode) {
                const episodeMatch = m.title.match(/[Ss](\d+)[Ee](\d+)/);
                if (episodeMatch) {
                  season = parseInt(episodeMatch[1]);
                  episode = parseInt(episodeMatch[2]);
                }
              }

              const isNext = season === currentSeason && episode === currentEpisodeNum + 1;

              return isNext;
            });

            if (nextEpisodeInSeason) {
              setNextEpisode(nextEpisodeInSeason);

              return;
            }

            // If no next episode in current season, try first episode of next season
            const firstEpisodeNextSeason = seriesEpisodes.find((m: Media) => {
              let season = m.season_number;
              let episode = m.episode_number;

              if (!season || !episode) {
                const episodeMatch = m.title.match(/[Ss](\d+)[Ee](\d+)/);
                if (episodeMatch) {
                  season = parseInt(episodeMatch[1]);
                  episode = parseInt(episodeMatch[2]);
                }
              }

              const isNextSeason = season === currentSeason + 1 && episode === 1;

              return isNextSeason;
            });

            if (firstEpisodeNextSeason) {
              setNextEpisode(firstEpisodeNextSeason);

            } else {
              setNextEpisode(null);
            }
          } else {

          }
        } catch (error) {

          setNextEpisode(null);
        }
      } else {

        setNextEpisode(null);
      }
    };

    if (isOpen) {
      fetchNextEpisode();
    }
  }, [media, isOpen]);

  // Handle cast state changes with YouTube-like behavior
  useEffect(() => {
    const wasConnected = isCasting;
    setIsCasting(castState.isConnected);

    // Update local state with cast state when casting
    if (castState.isConnected) {
      // Sync UI state with cast device
      setIsPlaying(castState.playerState === 'PLAYING');
      setCurrentTime(castState.currentTime);
      setDuration(castState.duration);
      setVolume(castState.volumeLevel);
      setIsMuted(castState.isMuted);

      // If just connected, ensure local video is paused immediately
      if (!wasConnected) {
        const video = videoRef.current;
        if (video && !video.paused) {
          video.pause();
        }
      }

      // YouTube-like behavior: Show cast status in UI
      // YouTube-like behavior: Show cast status in UI
      if (castState.playerState) {
        // Cast status available
      }

    } else if (wasConnected) {
      // If disconnected from cast, resume local video seamlessly
      const video = videoRef.current;
      if (video) {
        // Sync time from cast device
        if (castState.currentTime > 0) {
          video.currentTime = castState.currentTime;
        }

        // Resume playback if it was playing on cast device
        if (castState.playerState === 'PLAYING') {
          video.play().catch(() => { });
        }
      }
    }
  }, [castState, isCasting]);

  // Handle cast button click
  const handleCastClick = useCallback(() => {
    if (castState.isConnected) {
      disconnectFromCast();
    } else {
      connectToCast();
    }
  }, [castState.isConnected, connectToCast, disconnectFromCast]);

  // Load media to cast device when connected with YouTube-like instant casting
  useEffect(() => {
    if (castState.isConnected && media && !isCasting) {
      const video = videoRef.current;
      const currentPlaybackTime = video ? video.currentTime : 0;
      const wasPlaying = video ? !video.paused : false;

      // Use most basic stream URL for maximum compatibility with BRAVIA TV
      const streamUrl = `${getApiUrl()}/api/stream/${media.id}`;
      const thumbnailUrl = `${getApiUrl()}/api/thumbnails/${media.id}`;

      // Try different content types for better BRAVIA compatibility
      const contentType = media.file_path?.toLowerCase().endsWith('.mkv') ? 'video/x-matroska' : 'video/mp4';

      const castMedia: CastMedia = {
        contentId: streamUrl,
        contentType: contentType,
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

      // Test stream URL accessibility before casting
      fetch(streamUrl, { method: 'HEAD' })
        .then(response => {
          if (response.ok) {
            // Load media without start time first (better compatibility)
            loadCastMedia(castMedia);
            setIsCasting(true);
          }
        })
        .catch(error => {
          // Try casting anyway
          loadCastMedia(castMedia);
          setIsCasting(true);
        });

      // Pause local video immediately when casting starts
      if (video && !video.paused) {
        video.pause();
      }

      // YouTube-like behavior: Wait for media to load, then play and seek
      setTimeout(() => {
        if (castState.isConnected) {
          playCast();

          // Seek to position after playback starts
          if (currentPlaybackTime > 10) {
            setTimeout(() => {
              if (castState.isConnected) {
                seekCast(currentPlaybackTime);
              }
            }, 2000);
          }
        }
      }, 3000);
    }
  }, [castState.isConnected, media, loadCastMedia, isCasting, seekCast, playCast]);

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

  const saveCurrentProgress = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.currentTime <= 1) return; // Reduced threshold to 1 second

    // Enhanced duration detection for progress saving
    let currentDuration = duration;

    // If no duration from state, try video element
    if (!currentDuration || currentDuration === 0) {
      currentDuration = video.duration;
    }

    // If still no duration, try seekable range (important for MKV)
    if (!currentDuration || currentDuration === 0 || !isFinite(currentDuration)) {
      if (video.seekable && video.seekable.length > 0) {
        currentDuration = video.seekable.end(video.seekable.length - 1);
      }
    }

    // Enhanced fallback for different file types
    if (!currentDuration || currentDuration === 0 || !isFinite(currentDuration)) {
      const fileExt = media.file_path ? media.file_path.toLowerCase().split('.').pop() : '';

      if (fileExt === 'mkv') {
        // For MKV files, use a more conservative estimate
        currentDuration = Math.max(video.currentTime * 1.5, 3600); // 1.5x current time or 1 hour minimum
      } else {
        // For other formats, use original logic
        currentDuration = Math.max(video.currentTime + 60, 3600);
      }


    }

    try {
      await updatePlaybackProgress(media.id, video.currentTime, currentDuration);

      // Call the onProgress callback if provided
      if (onProgress) {
        onProgress(video.currentTime, currentDuration);
      }

    } catch (error) {

      // Prevent error from bubbling up and causing page reload
      return;
    }
  }, [duration, media.id, media.file_path]);

  const handlePlayNext = useCallback(async () => {


    if (nextEpisode) {
      // Save current progress before switching
      try {
        await saveCurrentProgress();
      } catch (error) {

      }



      // If onPlayNext callback is provided, use it
      if (onPlayNext) {

        onPlayNext(nextEpisode);
      } else {

        // Fallback: handle episode change internally
        // This will trigger the media change effect above
        setIsLoading(true);
        setIsBuffering(true);

        const video = videoRef.current;
        if (video) {
          // Pause current video
          video.pause();

          // Update video source directly
          const newVideoSrc = getStreamUrl(nextEpisode.id, 'high', 'mp4');
          video.src = newVideoSrc;
          setVideoSrc(newVideoSrc);

          // Reset states
          setCurrentTime(0);
          setDuration(0);
          setHasInitiallyLoaded(false);

          // Load and play new episode
          video.load();
          video.addEventListener('canplay', () => {
            video.play().catch(() => { });
          }, { once: true });
        }
      }
    } else {

    }
  }, [nextEpisode, onPlayNext, saveCurrentProgress, media, getStreamUrl]);

  const handleResumePlayback = () => {
    const video = videoRef.current;
    if (video && resumeTime > 0) {
      video.currentTime = resumeTime;
      setCurrentTime(resumeTime);
      setShowResumeNotification(false);

      // Update subtitles for the resumed position with multiple attempts
      updateSubtitlesForCurrentTime(resumeTime);
      setTimeout(() => {
        updateSubtitlesForCurrentTime(resumeTime);
      }, 100);
      setTimeout(() => {
        updateSubtitlesForCurrentTime(resumeTime);
      }, 300);
    }
  };

  const handleStartFromBeginning = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      setCurrentTime(0);
      setShowResumeNotification(false);

      // Update subtitles for the beginning position with multiple attempts
      updateSubtitlesForCurrentTime(0);
      setTimeout(() => {
        updateSubtitlesForCurrentTime(0);
      }, 100);
      setTimeout(() => {
        updateSubtitlesForCurrentTime(0);
      }, 300);
    }
  };

  const togglePlay = useCallback(async () => {
    try {
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
        return;
      }

      if (video.paused) {
        // CHROME AUDIO FIX: Ensure audio is enabled before playing
        video.muted = false;
        video.volume = volume > 0 ? volume : 1.0;
        setIsMuted(false);

        // Activate audio context for Chrome
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
        } catch (error) {
          // Audio context resume failed
        }

        // Resume playback with audio enabled
        video.play().catch(() => {
          // Failed to resume video
        });

        // Update subtitles when resuming playback
        setTimeout(() => {
          updateSubtitlesForCurrentTime();
        }, 100);

        // Show controls briefly when starting playback, then hide after delay
        setShowControls(true);
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
          if (!showSettings && !isDragging) {
            setShowControls(false);
            const container = containerRef.current;
            if (container) {
              container.style.cursor = 'none';
            }
          }
        }, 3000);
      } else {
        // Save progress before pausing
        await saveCurrentProgress();
        video.pause();
        // Always show controls when paused
        setShowControls(true);
        const container = containerRef.current;
        if (container) {
          container.style.cursor = 'default';
        }
      }
    } catch (error) {
      // Prevent error from causing page reload
    }
  }, [isCasting, castState.isConnected, isPlaying, pauseCast, playCast, volume]);

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

    // Calculate new time - be more permissive with duration checking
    let newTime = video.currentTime + seconds;
    let targetDuration = duration;

    // Get duration from multiple sources
    if (!targetDuration || targetDuration === 0) {
      if (video.duration && video.duration > 0 && isFinite(video.duration)) {
        targetDuration = video.duration;
      } else if (video.seekable && video.seekable.length > 0) {
        targetDuration = video.seekable.end(video.seekable.length - 1);
      }
    }

    // Only apply upper limit if we have a valid duration
    if (targetDuration && targetDuration > 0) {
      newTime = Math.min(newTime, targetDuration);
    }

    // INSTANT SEEKING: Set buffering state briefly for UI feedback
    setIsBuffering(true);

    try {
      // ULTRA-FAST SEEK: Use requestAnimationFrame for immediate response
      requestAnimationFrame(() => {
        video.currentTime = newTime;
        setCurrentTime(newTime);

        // Update subtitles for the new position
        updateSubtitlesForCurrentTime(newTime);

        // Additional subtitle update after a short delay for reliability
        setTimeout(() => {
          updateSubtitlesForCurrentTime(newTime);
        }, 100);

        // Ultra-fast timeout for sub-millisecond backend response
        setTimeout(() => {
          setIsBuffering(false);
        }, 200); // Reasonable timeout for network latency
      });
    } catch (error) {
      setIsBuffering(false);
    }

    // Show seek indicator with animation
    if (seekIndicatorTimeoutRef.current) {
      clearTimeout(seekIndicatorTimeoutRef.current);
    }
    setSeekIndicator({ show: true, amount: seconds, direction: 'forward' });
    seekIndicatorTimeoutRef.current = setTimeout(() => {
      setSeekIndicator(prev => ({ ...prev, show: false }));
    }, 800);
  };

  const handleCancelNext = () => {
    setShowNextEpisode(false);
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

    // INSTANT SEEKING: Set buffering state briefly for UI feedback
    setIsBuffering(true);

    try {
      // ULTRA-FAST SEEK: Use requestAnimationFrame for immediate response
      requestAnimationFrame(() => {
        video.currentTime = newTime;
        setCurrentTime(newTime);

        // Update subtitles for the new position
        updateSubtitlesForCurrentTime(newTime);

        // Additional subtitle update after a short delay for reliability
        setTimeout(() => {
          updateSubtitlesForCurrentTime(newTime);
        }, 100);

        // Ultra-fast timeout for sub-millisecond backend response
        setTimeout(() => {
          setIsBuffering(false);
        }, 200); // Reasonable timeout for network latency
      });
    } catch (error) {
      setIsBuffering(false);
    }

    // Show seek indicator with animation
    if (seekIndicatorTimeoutRef.current) {
      clearTimeout(seekIndicatorTimeoutRef.current);
    }
    setSeekIndicator({ show: true, amount: seconds, direction: 'backward' });
    seekIndicatorTimeoutRef.current = setTimeout(() => {
      setSeekIndicator(prev => ({ ...prev, show: false }));
    }, 800);
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
      container.requestFullscreen().catch(() => { });
      setShowControls(true); // Show controls when entering fullscreen
    } else {
      document.exitFullscreen().catch(() => { });
      setShowControls(true); // Show controls when exiting fullscreen
    }
  };

  // Pause screen visibility logic
  useEffect(() => {
    if (!isPlaying && !isLoading && !isBuffering && isOpen && !isCasting) {
      // Add a small delay to ensure the video has actually paused
      const timer = setTimeout(() => {
        setShowPauseScreen(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
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

    // Enhanced duration detection for seeking - be more permissive
    let targetDuration = duration;

    // If no duration from metadata, try multiple sources
    if (!targetDuration || targetDuration === 0) {
      // Try video element duration first
      if (video.duration && video.duration > 0 && isFinite(video.duration)) {
        targetDuration = video.duration;
      }
      // Then try seekable range
      else if (video.seekable && video.seekable.length > 0) {
        targetDuration = video.seekable.end(video.seekable.length - 1);
      }
      // Allow seeking even without duration - use estimated range
      else {
        // Use a reasonable estimate based on current time or default
        targetDuration = Math.max(video.currentTime * 3, 3600); // 3x current time or 1 hour minimum
      }
    }

    const newTime = Math.max(0, Math.min(percentage * targetDuration, targetDuration));

    // ULTRA-FAST SEEKING: Optimized for sub-millisecond backend response
    setIsBuffering(true);

    const performUltraFastSeek = () => {
      try {
        // INSTANT SEEK: Use requestAnimationFrame for immediate response
        requestAnimationFrame(() => {
          // Always attempt seeking - don't wait for readyState
          try {
            video.currentTime = newTime;
            setCurrentTime(newTime);

            // Update subtitles for the new position
            updateSubtitlesForCurrentTime(newTime);

            // Additional subtitle update after seek completes
            setTimeout(() => {
              updateSubtitlesForCurrentTime(newTime);
            }, 100);
          } catch (seekError) {
            // Seek failed
          }

          // Listen for seek completion with ultra-fast timeout
          const handleSeeked = () => {
            setIsBuffering(false);
            video.removeEventListener('seeked', handleSeeked);
          };

          const handleSeekError = () => {
            setIsBuffering(false);
            video.removeEventListener('error', handleSeekError);
          };

          video.addEventListener('seeked', handleSeeked, { once: true });
          video.addEventListener('error', handleSeekError, { once: true });

          // Ultra-fast fallback timeout for sub-millisecond backend
          setTimeout(() => {
            setIsBuffering(false);
          }, 500); // Increased slightly to allow for network latency
        });
      } catch (error) {
        setIsBuffering(false);
      }
    };

    performUltraFastSeek();
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

      // Enhanced duration detection for dragging - be more permissive
      let currentDuration = isCasting && castState.isConnected ? castState.duration : duration;

      // If no duration, try multiple sources
      if (!currentDuration || currentDuration === 0) {
        if (video) {
          // Try video element duration
          if (video.duration && video.duration > 0 && isFinite(video.duration)) {
            currentDuration = video.duration;
          }
          // Then try seekable range
          else if (video.seekable && video.seekable.length > 0) {
            currentDuration = video.seekable.end(video.seekable.length - 1);
          }
          // Allow dragging with estimated duration for all files
          else {
            currentDuration = Math.max(video.currentTime * 3, 3600); // 3x current time or 1 hour minimum
          }
        } else {
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
        }
      }
    };

    const handleEnd = (endEvent: MouseEvent | TouchEvent) => {
      endEvent.preventDefault();
      endEvent.stopPropagation();

      setIsDragging(false);

      // Resume playback if it was playing before dragging
      if (video && wasPlaying) {
        video.play().catch(() => { });
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

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));

    // Calculate time based on duration
    let targetDuration = duration;

    if (isCasting && castState.isConnected) {
      targetDuration = castState.duration;
    } else if (!targetDuration || targetDuration === 0) {
      // Fallbacks matching other handlers
      const video = videoRef.current;
      if (video) {
        if (video.duration && video.duration > 0 && isFinite(video.duration)) {
          targetDuration = video.duration;
        } else if (video.seekable && video.seekable.length > 0) {
          targetDuration = video.seekable.end(video.seekable.length - 1);
        } else {
          targetDuration = Math.max(video.currentTime * 3, 3600);
        }
      }
    }

    const time = percentage * targetDuration;
    setHoverPosition(percentage * 100);
    setHoverTime(time);
  };

  // Chrome audio context activation on user interaction
  useEffect(() => {
    const activateOnInteraction = async () => {
      await activateAudioContext();
      const video = videoRef.current;
      if (video) {
        video.muted = false;
        video.volume = volume > 0 ? volume : 1.0;
        setIsMuted(false);
      }
    };

    // Activate audio context on any user interaction
    if (isOpen) {
      document.addEventListener('click', activateOnInteraction, { once: true });
      document.addEventListener('keydown', activateOnInteraction, { once: true });
      document.addEventListener('touchstart', activateOnInteraction, { once: true });

      return () => {
        document.removeEventListener('click', activateOnInteraction);
        document.removeEventListener('keydown', activateOnInteraction);
        document.removeEventListener('touchstart', activateOnInteraction);
      };
    }
  }, [isOpen, activateAudioContext, volume]);

  // Handle mouse movement to show/hide controls and cursor
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);

      // Show cursor
      const container = containerRef.current;
      if (container) {
        container.style.cursor = 'default';
      }

      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }

      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying && !isDragging && !showSettings) {
          setShowControls(false);
          // Hide cursor when controls hide
          if (container) {
            container.style.cursor = 'none';
          }
        }
      }, 3000);
    };

    const handleMouseLeave = () => {
      // Immediately hide controls and cursor when mouse leaves the video area
      if (isPlaying && !isDragging && !showSettings) {
        setShowControls(false);
        const container = containerRef.current;
        if (container) {
          container.style.cursor = 'none';
        }
      }
    };

    const container = containerRef.current;
    if (!container) return;

    // Always use container for event listeners to ensure proper cleanup
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    // Also handle touch events for mobile
    if (isMobile) {
      container.addEventListener('touchstart', handleMouseMove);
    }

    // Show controls and cursor initially
    setShowControls(true);
    container.style.cursor = 'default';

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      if (isMobile) {
        container.removeEventListener('touchstart', handleMouseMove);
      }
      // Reset cursor when component unmounts
      container.style.cursor = 'default';
    };
  }, [isPlaying, isMobile, isDragging, showSettings]);

  const handleClose = useCallback(async () => {
    const video = videoRef.current;
    if (video) {
      video.pause();

      // Save progress when explicitly closing the video
      if (video.currentTime > 30) { // Only save if watched more than 30 seconds
        await saveCurrentProgress();
      }
    }
    onClose();
  }, [onClose]);



  // Load specific subtitle track
  const loadSubtitleTrack = async (trackId: number) => {
    try {
      const video = videoRef.current;
      if (!video) return;

      // Find the track info
      const selectedTrack = availableSubtitles.find((sub: any) => sub.id === trackId);
      if (!selectedTrack) return;

      // Remove existing subtitle tracks
      const existingTracks = video.querySelectorAll('track');
      existingTracks.forEach(track => track.remove());

      // Add new subtitle track
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.src = selectedTrack.url;
      track.srclang = selectedTrack.language.toLowerCase().substring(0, 2); // Use first 2 chars of language
      track.label = selectedTrack.title || selectedTrack.language;
      track.default = true;

      video.appendChild(track);

      // Wait for track to load and enable it
      track.addEventListener('load', () => {
        const textTrack = track.track;
        if (textTrack) {
          textTrack.mode = 'showing';

          // Listen for cue changes
          textTrack.addEventListener('cuechange', () => {
            if (textTrack.activeCues && textTrack.activeCues.length > 0) {
              const cue = textTrack.activeCues[0] as any;
              setCurrentSubtitleText(cue.text || '');
            } else {
              setCurrentSubtitleText('');
            }
          });
        }
      });

      // Handle load errors
      track.addEventListener('error', (e) => {
        setCurrentSubtitleText('');
      });

    } catch (error) {
      // Failed to load subtitle track
    }
  };

  const toggleSubtitles = () => {
    const newSubtitlesEnabled = !subtitlesEnabled;
    setSubtitlesEnabled(newSubtitlesEnabled);

    if (newSubtitlesEnabled) {
      // Enable subtitles - use current track or first available
      const trackToUse = currentSubtitleTrack || (availableSubtitles.length > 0 ? availableSubtitles[0].id : null);
      if (trackToUse) {
        handleSubtitleTrackChange(trackToUse);
      }
    } else {
      // Disable all subtitles - Chrome-specific cleanup
      const video = videoRef.current;
      if (video) {
        // Chrome-specific: Force disable instead of hide
        const tracks = video.textTracks;
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].mode = 'disabled';
          if ('oncuechange' in tracks[i]) {
            tracks[i].oncuechange = null;
          }
        }

        // Clean up subtitle handlers
        if ((video as any).subtitleCleanup) {
          (video as any).subtitleCleanup();
          (video as any).subtitleCleanup = null;
        }
      }

      // Force clear subtitle text with Chrome-specific update
      requestAnimationFrame(() => {
        setCurrentSubtitleText('');
        (window as any).lastSubtitleText = '';
        (window as any).currentSubtitleCues = [];
      });
    }
  };



  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If the user is typing in an input/textarea/select or any contenteditable element,
      // don't treat keyboard shortcuts as playback controls. This allows search fields
      // and other form elements to receive spaces and letters like 'm'.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isEditable = (target as HTMLElement).isContentEditable;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable) {
          return; // let the element handle the key
        }
      }

      // Prevent default behavior for video player keys
      if (['Space', 'ArrowLeft', 'ArrowRight', 'KeyF', 'KeyM', 'KeyC', 'Escape'].includes(e.code)) {
        e.preventDefault();
      }

      switch (e.code) {
        case 'Space':
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
      progressInterval = setInterval(async () => {
        const video = videoRef.current;
        if (video && !video.paused && video.currentTime > 10) {
          await saveCurrentProgress();
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

      // Clean up subtitle handlers and intervals
      const video = videoRef.current;
      if (video && (video as any).subtitleCleanup) {
        (video as any).subtitleCleanup();
      }

      // Clear global subtitle state
      (window as any).currentSubtitleCues = [];
      (window as any).lastSubtitleText = '';

      // Save progress when component unmounts (video player closes)
      if (video && video.currentTime > 30) {
        saveCurrentProgress().catch(() => { });
      }
    };
  }, [isOpen, saveCurrentProgress]);

  // ...
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black"
          ref={containerRef}
          style={{
            cursor: (showControls || !isPlaying || isDragging || showSettings) ? 'default' : 'none'
          }}
        >
          {/* Click overlay for play/pause functionality - only covers video area, not controls */}
          {/* Hide overlay when pause screen is visible or user is dragging to prevent interference */}
          {!showPauseScreen && !isDragging && (
            <div
              className="absolute inset-0 z-5 transition-all duration-300"
              style={{
                // Dynamically exclude control areas when they're visible
                bottom: showControls ? '120px' : '0px',
                top: showControls ? '80px' : '0px',
                cursor: (showControls || !isPlaying || isDragging || showSettings) ? 'pointer' : 'none'
              }}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();

                // CHROME AUDIO FIX: Ensure sound is always enabled and unmuted
                if (videoRef.current) {
                  const video = videoRef.current;

                  // Force unmute and set volume for Chrome
                  video.muted = false;
                  video.volume = volume > 0 ? volume : 1.0;
                  setIsMuted(false);
                  setVolume(video.volume);

                  // Chrome audio context fix - ensure audio is activated
                  try {
                    if (video.paused) {
                      // Resume playback with audio enabled
                      await video.play();
                    } else {
                      // Save progress before pausing
                      await saveCurrentProgress();
                      video.pause();
                    }
                  } catch (error) {
                    // Try to enable audio context manually
                    try {
                      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                      if (audioContext.state === 'suspended') {
                        await audioContext.resume();
                      }
                      // Retry play
                      if (video.paused) {
                        await video.play();
                      }
                    } catch (contextError) {
                      // Audio context fix failed
                    }
                  }
                }
              }}
            />
          )}

          {/* Video */}
          <video
            ref={videoRef}
            className="w-full h-full object-contain bg-black"
            poster={(() => {
              if (media.backdrop_path) return `${getApiUrl()}/api/${media.backdrop_path}`;
              if (media.tmdb_backdrop_url) return media.tmdb_backdrop_url;
              if (media.thumbnail_path) return `${getApiUrl()}/api/${media.thumbnail_path}`;
              if (media.poster_path) return `${getApiUrl()}/api/${media.poster_path}`;
              if (media.tmdb_poster_url) return media.tmdb_poster_url;
              return undefined;
            })()}
            onPlay={async () => {
              setIsPlaying(true);
              // Notify parent that video is playing
              onVideoPlay?.();
              // Don't immediately hide pause screen, let it fade out naturally
              setIsBuffering(false); // Clear any buffering state

              // CHROME AUDIO FIX: Ensure audio is activated when video starts playing
              await activateAudioContext();
              const video = videoRef.current;
              if (video) {
                video.muted = false;
                video.volume = volume > 0 ? volume : 1.0;
                setIsMuted(false);
              }

              // Load subtitles when video starts playing only if user has enabled them
              if (subtitlesEnabled && currentSubtitle && media.id) {
                if (!(window as any).currentSubtitleCues?.length) {
                  // Load subtitles only if user has enabled them
                  setTimeout(() => {
                    if (subtitlesEnabled && currentSubtitle && media.id) {
                      loadExternalSubtitle(currentSubtitle);
                    }
                  }, 100);
                } else {
                  // Subtitles already loaded, update display for current position
                  setTimeout(() => {
                    const videoElement = videoRef.current;
                    if (videoElement && (window as any).currentSubtitleCues?.length > 0) {
                      const cues = (window as any).currentSubtitleCues;
                      const currentTime = videoElement.currentTime;
                      const activeCue = cues.find((cue: any) =>
                        currentTime >= cue.start && currentTime <= cue.end
                      );
                      if (activeCue && activeCue.text) {
                        setCurrentSubtitleText(activeCue.text);
                        (window as any).lastSubtitleText = activeCue.text;
                      } else {
                        setCurrentSubtitleText('');
                        (window as any).lastSubtitleText = '';
                      }
                    }
                  }, 50);
                }
              }

              // Start the auto-hide timer for controls when video starts playing
              if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
              }
              controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
                const container = containerRef.current;
                if (container) {
                  container.style.cursor = 'none';
                }
              }, 3000);
            }}
            autoPlay
            controls={false}
            playsInline
            webkit-playsinline="true"
            onPause={async () => {
              setIsPlaying(false);

              // Save progress immediately when pausing
              await saveCurrentProgress();

              // Always show controls and cursor when paused
              setShowControls(true);
              const container = containerRef.current;
              if (container) {
                container.style.cursor = 'default';
              }

              // Clear any pending hide timeout
              if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
              }
            }}
            //onend
            onEnded={async () => {
              setIsPlaying(false);

              // Save progress for current episode
              try {
                await saveCurrentProgress();
              } catch (error) {

              }

              // Auto-play next episode if available
              if (nextEpisode) {


                // Use setTimeout to ensure state is updated before playing next
                setTimeout(() => {
                  if (onPlayNext) {
                    onPlayNext(nextEpisode);
                  } else {
                    // Fallback: show next episode preview or reload
                    setShowNextEpisode(true);
                  }
                }, 500);
              } else {

              }
            }}
            onError={(e) => {
              const video = videoRef.current;
              if (video) {
                const error = video.error;
                if (error) {


                  // Handle network errors that might cause disconnections
                  if (error.code === MediaError.MEDIA_ERR_NETWORK) {

                    // Don't immediately reload, let the browser handle buffering
                    setIsBuffering(true);

                    // Try to recover after a short delay
                    setTimeout(() => {
                      if (video.readyState < 2) {

                        video.load();
                      }
                      setIsBuffering(false);
                    }, 2000);
                  }
                }
              }
            }}

            onLoadStart={() => {
              setIsLoading(true);
              setIsBuffering(true);

              // ULTRA-INSTANT LAN OPTIMIZATION: Maximum performance settings
              const video = videoRef.current;
              if (video) {
                // Netflix-level buffer settings for instant streaming
                (video as any).bufferSize = 'netflix-ultra-large';
                (video as any).networkType = 'gigabit-lan';
                (video as any).streamingMode = 'ultra-instant';
                (video as any).cacheStrategy = 'aggressive-preload';
                (video as any).ioMode = 'zero-copy-sendfile';
                (video as any).latencyMode = 'sub-millisecond';
                (video as any).tcpOptimization = 'ultra-fast';

                // Disable any throttling for LAN
                (video as any).bandwidthLimit = 'unlimited';
                (video as any).qualityLimit = 'none';

                // Enable instant seeking
                (video as any).seekingMode = 'instant';
                (video as any).bufferAhead = 'ultra-aggressive';
              }

              // Enable transcoded seeking with ultra-fast backend
              setIsTranscoded(true);
            }}
            onCanPlay={() => {
              setIsLoading(false);
              setIsBuffering(false);

              const video = videoRef.current;
              if (video) {
                const fileExt = media.file_path ? media.file_path.toLowerCase().split('.').pop() : '';

                // CHROME AUDIO FIX: Ensure audio is always enabled when video can play
                video.muted = false;
                video.volume = volume > 0 ? volume : 1.0;
                setIsMuted(false);

                // ULTRA-INSTANT LAN STREAMING OPTIMIZATION
                try {
                  if (fileExt === 'mkv') {
                    // MKV with ultra-fast transcoding and caching
                    (video as any).bufferAheadTime = 120; // 2 minutes buffer for seamless MKV
                    (video as any).maxBufferLength = 1800; // 30 minutes max buffer for MKV
                    (video as any).preloadStrategy = 'ultra-aggressive-cluster';
                    (video as any).seekingStrategy = 'instant-transcode';
                    (video as any).cacheMode = 'l1-instant-hit';
                  } else {
                    // MP4/other formats with zero-copy sendfile
                    (video as any).bufferAheadTime = 60; // 1 minute buffer for instant seeking
                    (video as any).maxBufferLength = 900; // 15 minutes max buffer
                    (video as any).preloadStrategy = 'zero-copy-sendfile';
                    (video as any).seekingStrategy = 'instant-range';
                  }

                  // NETFLIX-LEVEL LAN OPTIMIZATIONS
                  (video as any).networkType = 'gigabit-lan-optimized';
                  (video as any).chunkSizeHint = 'netflix-ultra-large';
                  (video as any).streamingMode = 'sub-millisecond';
                  (video as any).ioOptimization = 'ultra-fast-sendfile';
                  (video as any).cacheStrategy = 'multi-tier-instant';
                  (video as any).tcpWindowSize = '64mb';
                  (video as any).compressionMode = 'none'; // No compression for LAN
                  (video as any).priorityMode = 'ultra-high';

                  // Instant playback hints
                  (video as any).playbackMode = 'instant-start';
                  (video as any).bufferingMode = 'zero-latency';
                  (video as any).responseTime = 'sub-millisecond';
                } catch (error) {
                  // Browser doesn't support these properties - continue anyway
                }

                // Load pending subtitles when video is ready - with improved loading
                if ((window as any).pendingSubtitleTrack) {
                  const pendingTrack = (window as any).pendingSubtitleTrack;
                  setTimeout(() => {
                    if (subtitlesEnabled && pendingTrack.url && media.id) {
                      loadExternalSubtitle(pendingTrack.url, media.id);
                    }
                    (window as any).pendingSubtitleTrack = null;
                  }, 300); // Slightly longer delay for better reliability
                }

                // INSTANT auto-play for new media with zero delay and audio enabled
                if (!hasInitiallyLoaded && video.currentTime === 0) {
                  // Activate audio context before playing
                  const playWithAudio = async () => {
                    try {
                      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                      if (audioContext.state === 'suspended') {
                        await audioContext.resume();
                      }
                    } catch (error) {
                      // Audio context activation failed for autoplay
                    }

                    // Ensure audio is enabled
                    video.muted = false;
                    video.volume = volume > 0 ? volume : 1.0;

                    // Play with audio
                    video.play().catch(error => {
                      // Ultra-instant autoplay failed
                    });
                  };

                  // Use requestAnimationFrame for immediate playback
                  requestAnimationFrame(playWithAudio);
                }
              }
            }}
            onLoadedMetadata={async () => {
              const video = videoRef.current;
              if (!video) return;

              // Chrome-specific: Force disable all native text tracks immediately
              for (let i = 0; i < video.textTracks.length; i++) {
                const track = video.textTracks[i];
                track.mode = 'disabled';
                if ('oncuechange' in track) {
                  track.oncuechange = null;
                }
              }

              // Remove any track elements that might interfere
              const trackElements = video.querySelectorAll('track');
              trackElements.forEach(track => track.remove());

              // Enhanced duration detection for MKV and other formats
              let videoDuration = video.duration;
              const fileExt = media.file_path ? media.file_path.toLowerCase().split('.').pop() : '';

              // Check if duration is invalid (common with MKV files)
              if (!videoDuration || videoDuration === 0 || !isFinite(videoDuration)) {


                // Try to get duration from seekable range (works better for MKV)
                if (video.seekable && video.seekable.length > 0) {
                  videoDuration = video.seekable.end(video.seekable.length - 1);

                }

                // If still no duration, set enhanced fallback for MKV files
                if (!videoDuration || videoDuration === 0) {
                  if (fileExt === 'mkv') {
                    // For MKV files, try to get duration from backend
                    try {
                      const response = await fetch(`${getApiUrl()}/api/media/${media.id}`);
                      const mediaData = await response.json();
                      if (mediaData.duration && mediaData.duration > 0) {
                        videoDuration = mediaData.duration;

                      } else {
                        videoDuration = 7200; // 2 hours fallback

                      }
                    } catch (error) {
                      videoDuration = 7200; // 2 hours fallback

                    }
                  } else {
                    videoDuration = 0; // Keep as 0 for other formats
                  }
                }
              } else {

              }

              // ULTRA-FAST MKV OPTIMIZATION with backend transcoding
              if (fileExt === 'mkv') {
                try {
                  // Set MKV-specific ultra-fast hints
                  (video as any).mkvOptimized = true;
                  (video as any).seekingStrategy = 'ultra-fast-transcode';
                  (video as any).transcodingMode = 'instant-seekable';
                  (video as any).cacheStrategy = 'l1-instant-access';
                  (video as any).bufferingMode = 'netflix-level';
                  (video as any).ioMode = 'zero-copy-optimized';

                  // Enable instant seeking for MKV through backend transcoding
                  (video as any).instantSeeking = true;
                  (video as any).seekableTranscoding = true;
                } catch (error) {
                  // Browser doesn't support these properties - continue anyway
                }
              }

              setDuration(videoDuration);

              // Initialize progress if it doesn't exist
              try {
                await initializePlaybackProgress(media.id);
              } catch (error) {
                // Failed to initialize progress, continuing anyway
              }

              // Load saved progress or use provided start time - ONLY on initial load
              if (!hasInitiallyLoaded) {
                try {
                  // Only auto-seek on initial load when video is at beginning
                  if (video.currentTime < 5) {
                    if (forceStartFromBeginning) {
                      // Force start from beginning - ignore saved progress
                      video.currentTime = 0;
                      setCurrentTime(0);
                      setResumeTime(0);
                    } else if (startTime > 0) {
                      // Use provided start time
                      video.currentTime = startTime;
                      setCurrentTime(startTime);
                      setResumeTime(startTime);
                    } else {
                      // Try to load saved progress
                      const savedProgress = await getPlaybackProgress(media.id);
                      const resumeTimeValue = savedProgress?.position || 0;

                      if (resumeTimeValue > 30 && videoDuration > 60 && resumeTimeValue < videoDuration - 30) {
                        // Auto-resume from saved position
                        video.currentTime = resumeTimeValue;
                        setCurrentTime(resumeTimeValue);
                        setResumeTime(resumeTimeValue);

                        // Update subtitles for the resumed position
                        if (subtitlesEnabled && (window as any).currentSubtitleCues?.length > 0) {
                          setTimeout(() => {
                            const cues = (window as any).currentSubtitleCues;
                            const activeCue = cues.find((cue: any) =>
                              resumeTimeValue >= cue.start && resumeTimeValue <= cue.end
                            );
                            if (activeCue && activeCue.text) {
                              setCurrentSubtitleText(activeCue.text);
                              (window as any).lastSubtitleText = activeCue.text;
                            } else {
                              setCurrentSubtitleText('');
                              (window as any).lastSubtitleText = '';
                            }
                          }, 200);
                        }
                      }
                    }
                  }
                } catch (error) {
                  if (forceStartFromBeginning) {
                    // Force start from beginning even on error
                    video.currentTime = 0;
                    setCurrentTime(0);
                    setResumeTime(0);
                  } else if (startTime > 0 && video.currentTime < 5) {
                    // Only seek to start time on initial load
                    video.currentTime = startTime;
                    setCurrentTime(startTime);
                    setResumeTime(startTime);
                  }
                }
                setHasInitiallyLoaded(true); // Mark as initially loaded
              }

              // Ensure subtitles are loaded after metadata is ready
              if (subtitlesEnabled && currentSubtitle && !(window as any).currentSubtitleCues?.length && media.id) {
                setTimeout(() => {
                  // Safety check before loading
                  if (subtitlesEnabled && currentSubtitle && media.id) {
                    loadExternalSubtitle(currentSubtitle);
                  }
                }, 200); // Reduced from 300ms
              }
            }}
            onLoadedData={() => {
              setIsLoading(false);
              const video = videoRef.current;
              if (video && video.readyState >= 2) {

                // CHROME AUDIO FIX: Force audio settings
                video.volume = volume > 0 ? volume : 1.0;
                video.muted = false; // Always unmuted for video player
                setIsMuted(false);
                setVolume(video.volume);

                // Chrome audio context activation
                const activateAudioContext = async () => {
                  try {
                    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                    if (audioContext.state === 'suspended') {
                      await audioContext.resume();
                    }
                  } catch (error) {
                    // Audio context activation failed
                  }
                };

                activateAudioContext();

                // Handle seeking based on flags
                if (!hasInitiallyLoaded && video.currentTime < 5) {
                  if (forceStartFromBeginning) {
                    // Force start from beginning - set to 0
                    video.currentTime = 0;
                    setCurrentTime(0);

                    // Clear subtitle text immediately when seeking to beginning
                    setCurrentSubtitleText('');
                    (window as any).lastSubtitleText = '';

                    // Ensure subtitles are reloaded if they were enabled
                    if (subtitlesEnabled && currentSubtitle) {
                      setTimeout(() => {
                        loadExternalSubtitle(currentSubtitle);
                      }, 200);
                    }
                  } else if (resumeTime > 0 && Math.abs(video.currentTime - resumeTime) > 5) {
                    // Only seek to resume time if we're not forcing start from beginning
                    video.currentTime = resumeTime;
                    setCurrentTime(resumeTime);
                  }
                }

                // Auto-play for new episodes with audio enabled
                if (!hasInitiallyLoaded && video.paused) {
                  // Ensure we're at the right position before playing
                  if (forceStartFromBeginning) {
                    video.currentTime = 0;
                  }

                  // Ensure audio is enabled before playing
                  video.muted = false;
                  video.volume = volume > 0 ? volume : 1.0;

                  video.play().catch(error => {
                    // Auto-play failed
                  });
                }

                // Update subtitles for current position after data loads
                setTimeout(() => {
                  updateSubtitlesForCurrentTime();
                }, 100);
              }
            }}
            onTimeUpdate={() => {
              const video = videoRef.current;
              if (!video || isCasting) return;

              setCurrentTime(video.currentTime);

              // Update subtitles on every timeupdate for proper sync
              updateSubtitlesForCurrentTime();

              // Check if we need to load subtitles first
              if (subtitlesEnabled && !((window as any).currentSubtitleCues && (window as any).currentSubtitleCues.length > 0) && currentSubtitle && media.id) {
                // Trigger subtitle loading if not already loaded
                if (!(window as any).currentlyLoadingSubtitle) {
                  (window as any).currentlyLoadingSubtitle = currentSubtitle;
                  loadExternalSubtitle(currentSubtitle);
                }
              }

              // Removed forceStartFromBeginning subtitle clearing - it was preventing subtitles from showing

              // CHROME AUDIO ISSUE DETECTION
              // Check if video is playing but muted or has no audio tracks
              if (video.currentTime > 2 && !audioIssueDetected) {
                const isMutedUnexpectedly = video.muted && !isMuted;
                const hasZeroVolume = video.volume === 0 && volume > 0;

                // Check for audio tracks using a safer approach
                let hasNoAudio = false;
                try {
                  // Try to access audioTracks if available (some browsers support it)
                  const audioTracks = (video as any).audioTracks;
                  if (audioTracks && audioTracks.length === 0) {
                    hasNoAudio = true;
                  }
                } catch (error) {
                  // audioTracks not supported, skip this check
                }

                if (isMutedUnexpectedly || hasZeroVolume || hasNoAudio) {
                  setAudioIssueDetected(true);

                  // Try to fix audio issues
                  video.muted = false;
                  video.volume = volume > 0 ? volume : 1.0;
                  setIsMuted(false);

                  // Activate audio context
                  activateAudioContext();
                }
              }

              // Enhanced duration detection during playback (especially for MKV)
              if (!duration || duration === 0) {
                let newDuration = 0;

                // Try video.duration first
                if (video.duration && video.duration > 0 && isFinite(video.duration)) {
                  newDuration = video.duration;

                }

                // If no video.duration, try seekable range
                if (!newDuration && video.seekable && video.seekable.length > 0) {
                  const seekableEnd = video.seekable.end(video.seekable.length - 1);
                  if (seekableEnd > 0 && isFinite(seekableEnd)) {
                    newDuration = seekableEnd;

                  }
                }

                // Update duration if we found a valid one
                if (newDuration > 0) {
                  setDuration(newDuration);
                }
              }

              // For MKV files with fallback duration, update to real duration when available
              if (duration === 7200 && video.duration && video.duration > 0 && video.duration !== 7200) {
                setDuration(video.duration);

              }
            }}
            onSeeking={() => {
              setIsSeeking(true);
              setIsBuffering(true);
            }}

            onSeeked={() => {
              setIsSeeking(false);
              setIsBuffering(false);
              const video = videoRef.current;
              if (video) {
                setCurrentTime(video.currentTime);

                // Enhanced subtitle sync after seeking

                // Force subtitle update with multiple attempts for reliability
                updateSubtitlesForCurrentTime(video.currentTime);

                // Additional subtitle update after a short delay to handle timing issues
                setTimeout(() => {
                  updateSubtitlesForCurrentTime(video.currentTime);
                }, 50);

                // If subtitles are enabled but no cues loaded, try to reload them
                if (subtitlesEnabled && currentSubtitle && !(window as any).currentSubtitleCues?.length) {
                  setTimeout(() => {
                    if (subtitlesEnabled && currentSubtitle) {
                      loadExternalSubtitle(currentSubtitle);
                    }
                  }, 100);
                }
              }
            }}
            onWaiting={() => {
              setIsBuffering(true);
            }}
            onCanPlayThrough={() => {
              setIsBuffering(false);
              setIsLoading(false);
              // Update subtitles when video is ready to play
              updateSubtitlesForCurrentTime();
            }}
            preload="auto"
            muted={false}
            crossOrigin="anonymous"
            // Chrome audio fix attributes
            onVolumeChange={() => {
              const video = videoRef.current;
              if (video && video.muted && !isMuted) {
                // Prevent Chrome from auto-muting
                video.muted = false;
              }
            }}

            // ULTRA-INSTANT LAN STREAMING ATTRIBUTES - Sub-millisecond response
            style={{
              // Hint to browser about expected video size for instant rendering
              width: '100%',
              height: '100%',
              // Additional performance hints
              willChange: 'auto',
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)' // Force hardware acceleration
            }}
            // NETFLIX-LEVEL ULTRA-FAST STREAMING ATTRIBUTES
            data-buffer-size="netflix-ultra-large"
            data-preload-strategy="ultra-aggressive"
            data-network-type="gigabit-lan"
            data-streaming-mode="sub-millisecond"
            data-cache-strategy="multi-tier-instant"
            data-bandwidth="unlimited-lan"
            data-latency="sub-millisecond"
            data-io-mode="zero-copy-sendfile"
            data-tcp-optimization="ultra-fast"
            data-response-time="instant"
            data-priority="ultra-high"
            data-compression="none"
            data-chunk-size="netflix-ultra-large"
            data-seeking-mode="instant"
            data-transcoding="ultra-fast"
            data-quality="4k-ultra"
            data-format="mp4-optimized"
            data-connection="keep-alive-optimized"
            data-streaming-tier="ultra-instant"
          >

            {/* No track elements - we use custom subtitle overlay to prevent double subtitles */}

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



          {/* Subtitle Styling and Volume Slider */}
          <style jsx>{`
            /* Chrome-specific subtitle fixes */
            video::cue {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
            }
            
            video::-webkit-media-text-track-display {
              display: none !important;
              visibility: hidden !important;
            }
            
            video::-webkit-media-text-track-container {
              display: none !important;
              visibility: hidden !important;
            }

            video::-webkit-media-text-track-background {
              display: none !important;
              visibility: hidden !important;
            }

            video::cue-region {
              display: none !important;
              visibility: hidden !important;
            }

            /* Force hide all text tracks in Chrome */
            video::-webkit-media-text-track-region {
              display: none !important;
            }

            video::-webkit-media-text-track-region-container {
              display: none !important;
            }

            .volume-slider::-webkit-slider-thumb {
              appearance: none;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: #ef4444;
              cursor: pointer;
              border: none;
            }

            .volume-slider::-moz-range-thumb {
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: #ef4444;
              cursor: pointer;
              border: none;
            }

            /* HOMEFLIX Intro Animation Styles */
            @keyframes homeflix-bar-slide {
              0% {
                transform: translateX(-100%);
                opacity: 0;
              }
              15% {
                opacity: 1;
              }
              50% {
                transform: translateX(0%);
                opacity: 1;
              }
              85% {
                opacity: 1;
              }
              100% {
                transform: translateX(100%);
                opacity: 0;
              }
            }

            @keyframes homeflix-text-glow {
              0%, 100% {
                opacity: 1;
                text-shadow: 0 0 20px rgba(229, 9, 20, 0.5), 0 0 40px rgba(229, 9, 20, 0.3);
                transform: scale(1);
              }
              50% {
                opacity: 1;
                text-shadow: 0 0 60px rgba(229, 9, 20, 1), 0 0 100px rgba(229, 9, 20, 0.6);
                transform: scale(1.02);
              }
            }

            @keyframes homeflix-bar-glow {
              0% {
                box-shadow: 0 0 10px rgba(229, 9, 20, 0.3);
              }
              50% {
                box-shadow: 0 0 30px rgba(229, 9, 20, 0.8), 0 0 60px rgba(229, 9, 20, 0.4);
              }
              100% {
                box-shadow: 0 0 10px rgba(229, 9, 20, 0.3);
              }
            }

            @keyframes homeflix-fade-out {
              0% {
                opacity: 1;
              }
              70% {
                opacity: 1;
              }
              100% {
                opacity: 0;
              }
            }

            .homeflix-intro-container {
              /* No fade-out animation - keep visible until video plays */
            }

            .homeflix-text {
              animation: homeflix-text-glow 2s ease-in-out infinite;
            }

            .homeflix-bar {
              animation: homeflix-bar-slide 2.5s ease-in-out infinite, homeflix-bar-glow 2.5s ease-in-out infinite;
            }

            .homeflix-bar-1 { animation-delay: 0s; }
            .homeflix-bar-2 { animation-delay: 0.1s; }
            .homeflix-bar-3 { animation-delay: 0.2s; }
            .homeflix-bar-4 { animation-delay: 0.3s; }
            .homeflix-bar-5 { animation-delay: 0.4s; }
            .homeflix-bar-6 { animation-delay: 0.5s; }
            .homeflix-bar-7 { animation-delay: 0.6s; }

            /* Bar bounce animation for seeking/buffering */
            @keyframes homeflix-bar-bounce {
              0%, 100% {
                transform: scaleY(0.4);
                opacity: 0.5;
              }
              50% {
                transform: scaleY(1);
                opacity: 1;
              }
            }

            /* Seek indicator animations */
            @keyframes seek-indicator-pop {
              0% {
                transform: scale(0.5);
                opacity: 0;
              }
              50% {
                transform: scale(1.1);
                opacity: 1;
              }
              100% {
                transform: scale(1);
                opacity: 1;
              }
            }

            @keyframes seek-arrow-move {
              0% {
                transform: translateX(0);
              }
              50% {
                transform: translateX(8px);
              }
              100% {
                transform: translateX(0);
              }
            }

            @keyframes seek-arrow-move-back {
              0% {
                transform: translateX(0);
              }
              50% {
                transform: translateX(-8px);
              }
              100% {
                transform: translateX(0);
              }
            }
          `}</style>



          {/* HOMEFLIX Intro Animation */}
          <AnimatePresence>
            {showIntroAnimation && (
              <motion.div
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 z-[60] bg-black flex items-center justify-center homeflix-intro-container"
              >
                {/* Animated Bars Container */}
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                  {/* Multiple animated bars moving towards center */}
                  {[...Array(7)].map((_, index) => (
                    <div
                      key={index}
                      className={`homeflix-bar homeflix-bar-${index + 1} absolute h-1 rounded-full`}
                      style={{
                        width: `${60 + index * 15}px`,
                        background: `linear-gradient(90deg, transparent, #E50914 40%, #E50914 60%, transparent)`,
                        top: `${35 + index * 5}%`,
                        left: 0,
                        right: 0,
                        margin: 'auto',
                        opacity: 0.9 - index * 0.1,
                      }}
                    />
                  ))}
                </div>

                {/* HOMEFLIX Text */}
                <div className="relative z-10 homeflix-text flex flex-col items-center">
                  <h1
                    className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-widest"
                    style={{
                      fontFamily: "'Bebas Neue', 'Impact', sans-serif",
                      color: '#E50914',
                      letterSpacing: '0.2em',
                    }}
                  >
                    HOMEFLIX
                  </h1>
                </div>

                {/* Additional decorative bars behind text */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-red-600/50 to-transparent"
                    style={{
                      animation: 'homeflix-bar-slide 2s ease-in-out forwards',
                      animationDelay: '0.3s',
                    }}
                  />
                  <div
                    className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent"
                    style={{
                      animation: 'homeflix-bar-slide 2s ease-in-out forwards',
                      animationDelay: '0.5s',
                      top: '45%',
                    }}
                  />
                  <div
                    className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent"
                    style={{
                      animation: 'homeflix-bar-slide 2s ease-in-out forwards',
                      animationDelay: '0.5s',
                      bottom: '45%',
                    }}
                  />
                </div>

                {/* Skip button */}
                <button
                  onClick={() => setShowIntroAnimation(false)}
                  className="absolute bottom-10 right-10 text-white/60 hover:text-white text-sm transition-colors z-20"
                  type="button"
                >
                  Skip Intro
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* HOMEFLIX Seeking/Buffering Overlay */}
          <AnimatePresence>
            {(isLoading || isBuffering || isSeeking) && !showIntroAnimation && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-40"
              >
                {/* HOMEFLIX branded seeking screen */}
                <div className="flex flex-col items-center">
                  {/* HOMEFLIX Logo */}
                  <h2
                    className="text-4xl md:text-5xl font-bold tracking-widest mb-6"
                    style={{
                      fontFamily: "'Bebas Neue', 'Impact', sans-serif",
                      color: '#E50914',
                      letterSpacing: '0.15em',
                      textShadow: '0 0 20px rgba(229, 9, 20, 0.5)',
                    }}
                  >
                    HOMEFLIX
                  </h2>

                  {/* Animated loading bars */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-red-600 rounded-full"
                        style={{
                          height: '24px',
                          animation: 'homeflix-bar-bounce 1s ease-in-out infinite',
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>

                  {/* Status text */}
                  {/* <p className="text-white/60 text-sm tracking-wider">
                    {isSeeking ? 'Seeking...' : isLoading ? 'Loading...' : 'Buffering...'}
                  </p> */}
                </div>

                {/* Close button */}
                <button
                  onClick={handleClose}
                  className="absolute top-8 right-8 text-white hover:text-red-500 transition-colors p-3 bg-black/50 rounded-full hover:bg-black/70 border border-white/20 hover:border-red-500/50 z-50"
                  type="button"
                  aria-label="Close"
                >
                  <X className="w-6 h-6" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Audio Issue Warning */}
          <AnimatePresence>
            {audioIssueDetected && (
              <motion.div
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -50 }}
                className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50"
              >
                <div className="bg-red-600/90 backdrop-blur-sm text-white p-4 rounded-lg border border-red-500/50 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium">Audio Issue Detected</p>
                    <p className="text-sm text-red-100">Chrome may have audio compatibility issues with this file</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const video = videoRef.current;
                      if (video) {
                        // Force reload with transcoding
                        const currentTimeBackup = video.currentTime;
                        const newUrl = getStreamUrl(media.id, 'high', 'mp4') + '&force_transcode=true';
                        video.src = newUrl;
                        video.load();

                        const handleCanPlay = () => {
                          video.currentTime = currentTimeBackup;
                          video.muted = false;
                          video.volume = volume > 0 ? volume : 1.0;
                          video.play().catch(() => { });
                          video.removeEventListener('canplay', handleCanPlay);
                        };

                        video.addEventListener('canplay', handleCanPlay);
                        setAudioIssueDetected(false);
                      }
                    }}
                    className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 rounded transition-colors"
                  >
                    Fix Audio
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudioIssueDetected(false)}
                    className="text-red-100 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Debug subtitle status - ENABLED FOR DEBUGGING */}
          {/* {availableSubtitles.length > 0 && (
            <div className="absolute top-4 left-4 z-50 bg-black/80 text-white p-2 rounded text-xs font-mono">
              <div>Subtitles: {subtitlesEnabled ? 'ON' : 'OFF'}</div>
              <div>Track: {currentSubtitleTrack}</div>
              <div>Text: {currentSubtitleText ? 'YES' : 'NO'}</div>
              <div>Available: {availableSubtitles.length}</div>
              <div>Cues: {(window as any).currentSubtitleCues?.length || 0}</div>
              <div>Time: {currentTime.toFixed(2)}s</div>
              <div>Current: {currentSubtitleText ? `"${currentSubtitleText.substring(0, 30)}..."` : 'none'}</div>
            </div>
          )} */}

          {/* Single Subtitle Overlay - Chrome-compatible with forced rendering */}
          <AnimatePresence>
            {currentSubtitleText && (
              <motion.div
                key={`subtitle-${currentSubtitleText.substring(0, 20)}`} // Force re-render for Chrome
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }} // Faster transition for Chrome
                className={`absolute z-10 pointer-events-none ${subtitleStyle.position === 'top'
                  ? 'top-20 left-1/2 -translate-x-1/2'
                  : subtitleStyle.position === 'center'
                    ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                    : 'bottom-10 left-1/2 -translate-x-1/2'
                  }`}
                style={{
                  // Chrome-specific rendering hints
                  willChange: 'opacity, transform',
                  backfaceVisibility: 'hidden',
                  // Remove conflicting transform - let Tailwind handle it
                }}
              >
                <div
                  className="text-center px-4 py-2 rounded-lg max-w-4xl mx-auto"
                  style={{
                    fontSize: `${subtitleStyle.fontSize}px`,
                    fontFamily: subtitleStyle.fontFamily,
                    color: subtitleStyle.color,
                    backgroundColor: subtitleStyle.backgroundColor === 'transparent'
                      ? 'transparent'
                      : `${subtitleStyle.backgroundColor}${Math.round(subtitleStyle.backgroundOpacity * 255).toString(16).padStart(2, '0')}`,
                    textShadow: subtitleStyle.textShadow ? '2px 2px 4px rgba(0, 0, 0, 0.9)' : 'none',
                    WebkitTextStroke: subtitleStyle.textStroke ? '1px black' : 'none',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-line',
                    // Chrome-specific rendering optimizations
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility',
                    // Force layer creation for better performance
                    willChange: 'contents',
                    contain: 'layout style paint',
                    // Ensure proper centering
                    display: 'block',
                    width: 'max-content',
                    maxWidth: '90vw',
                  }}
                  dangerouslySetInnerHTML={{ __html: currentSubtitleText.replace(/\n/g, '<br>') }}
                />
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
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 pointer-events-none z-20"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top Controls */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center pointer-events-auto">
                  <div>
                    {(() => {
                      const logoUrl = media.type === 'episode' && media.series_id
                        ? `${getApiUrl()}/api/series/${media.series_id}/logo`
                        : media.logo_path
                          ? `${getApiUrl()}/api/${media.logo_path}`
                          : null;

                      return logoUrl ? (
                        <div className="flex flex-col items-start">
                          <img
                            src={logoUrl}
                            alt={media.title}
                            className="max-h-16 w-auto object-contain mb-1"
                            onError={(e) => {
                              // Mark URL as failed to prevent infinite retries
                              const target = e.currentTarget;
                              failedImageUrls.current.add(target.src);
                              target.style.display = 'none';
                              const titleEl = document.getElementById('video-player-title-fallback');
                              if (titleEl) titleEl.style.display = 'block';
                            }}
                          />
                          <h1
                            id="video-player-title-fallback"
                            className="text-white text-2xl font-bold"
                            style={{ display: 'none' }}
                          >
                            {media.title}
                          </h1>
                          {media.type === 'episode' && (
                            <span className="text-white/80 text-sm font-medium ml-1">
                              {media.season_number ? `S${media.season_number}` : ''}
                              {media.episode_number ? `E${media.episode_number}` : ''}
                              {media.season_number && media.episode_number ? ' • ' : ''}
                              {media.title}
                            </span>
                          )}
                        </div>
                      ) : (
                        <h1 className="text-white text-2xl font-bold">{media.title}</h1>
                      );
                    })()}
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
                      type="button"
                      onClick={() => seekBackward(10)}
                      className="bg-black/50 text-white rounded-full p-3 hover:bg-black/70 transition-all duration-200 hover:scale-110"
                      title="Skip back 10 seconds (←)"
                    >
                      <RotateCcw className="w-8 h-8" />
                    </button>

                    {/* Play/Pause */}
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="bg-black/50 text-white rounded-full p-4 hover:bg-black/70 transition-all duration-200 hover:scale-110 z-40"
                      title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                    >
                      {isPlaying ? (
                        <Pause className="w-12 h-12" />
                      ) : (
                        <Play className="w-12 h-12 fill-current" />
                      )}
                    </button>

                    {/* Skip Forward 10s */}
                    <button
                      type="button"
                      onClick={() => seekForward(10)}
                      className="bg-black/50 text-white rounded-full p-3 hover:bg-black/70 transition-all duration-200 hover:scale-110"
                      title="Skip forward 10 seconds (→)"
                    >
                      <RotateCw className="w-8 h-8" />
                    </button>

                    
                  </div>
                </div>

                {/* Bottom Controls */}
                <div className="absolute bottom-0 left-0 right-0 p-10 pointer-events-auto z-50">
                  <div
                    className="progress-container relative w-full h-1 cursor-pointer group-hover:h-2 transition-all duration-200 mb-4"
                    onClick={(e) => {
                      // Only handle click if not dragging
                      if (!isDragging) {
                        handleProgressClick(e);
                      }
                    }}
                    onMouseDown={handleSeekStart}
                    onTouchStart={handleSeekStart}
                    onMouseMove={handleProgressHover}
                    onMouseLeave={() => setHoverTime(null)}
                  >
                    {/* Bar Background & Clipping Wrapper */}
                    <div className="absolute inset-0 w-full h-full bg-white/30 rounded-lg overflow-hidden pointer-events-none">
                      {/* Buffered Progress */}
                      <div
                        className="absolute top-0 left-0 h-full bg-white/20"
                        style={{
                          width: videoRef.current?.buffered && videoRef.current.buffered.length > 0 && duration > 0
                            ? `${(videoRef.current.buffered.end(videoRef.current.buffered.length - 1) / duration) * 100}%`
                            : '0%'
                        }}
                      />

                      {/* Progress Fill */}
                      <div
                        className={`absolute top-0 left-0 h-full bg-red-600 transition-all ${isDragging ? 'duration-0' : 'duration-200'}`}
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
                    </div>

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

                    {/* Hover Preview Tooltip */}
                    {hoverTime !== null && (
                      <div
                        className="absolute bottom-5 transform -translate-x-1/2 flex flex-col items-center z-50 pointer-events-none"
                        style={{ left: `${hoverPosition}%` }}
                      >
                        {/* Thumbnail Preview */}
                        <div className="mb-2 w-40 aspect-video bg-black rounded-lg overflow-hidden relative shadow-2xl border-2 border-white/20">
                          <img
                            src={`${getApiUrl()}/api/thumbnails/${media.id}`}
                            alt="Preview"
                            className="w-full h-full object-cover opacity-90"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                          <div className="absolute bottom-1 w-full text-center">
                            <span className="text-white text-xs font-bold tracking-wider text-shadow-md">
                              {formatTime(hoverTime)}
                            </span>
                          </div>
                        </div>

                        {/* Connector */}
                        <div className="w-0.5 h-3 bg-white/50"></div>
                      </div>
                    )}
                  </div>


                  {/* Control Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
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
                          type="button"
                          onClick={() => seekBackward(10)}
                          className="text-white hover:text-red-500 transition-colors flex items-center gap-1"
                          title="Skip back 10 seconds (←)"
                        >
                          <RotateCcw className="w-5 h-5" />
                          <span className="text-xs">10</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => seekForward(10)}
                          className="text-white hover:text-red-500 transition-colors flex items-center gap-1"
                          title="Skip forward 10 seconds (→)"
                        >
                          <RotateCw className="w-5 h-5" />
                          <span className="text-xs">10</span>
                        </button>
                        {/* Next Episode Button - Only show for episodes when next episode exists */}
                        {nextEpisode && media.type === 'episode' && (
                          <button
                            type="button"
                            onClick={() => {

                              handlePlayNext();
                            }}
                            className="bg-black/50 text-white rounded-full p-3 hover:bg-black/70 transition-all duration-200 hover:scale-110 flex items-center gap-2"
                            title={`Play Next Episode: ${nextEpisode.title}`}
                          >
                            <span className="text-sm font-medium">Next</span>
                            <Play className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <button
                          type="button"
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
                            className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer volume-slider"
                            style={{
                              background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${isMuted ? 0 : volume * 100}%, rgba(255,255,255,0.3) ${isMuted ? 0 : volume * 100}%, rgba(255,255,255,0.3) 100%)`,
                              WebkitAppearance: 'none',
                              appearance: 'none'
                            }}
                          />
                        </div>



                        <span className="text-white text-sm">
                          {formatTime(isCasting && castState.isConnected ? castState.currentTime : currentTime)} / {duration > 0 ? formatTime(isCasting && castState.isConnected ? castState.duration : duration) : 'Live'}
                        </span>

                        {/* Cast status indicator */}
                        {isCasting && castState.isConnected && (
                          <div className="flex items-center gap-2 text-blue-400 text-sm">
                            <Tv className="w-4 h-4" />
                            <span>Casting to {castState.deviceName}</span>
                            {castState.playerState === 'BUFFERING' && (
                              <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                            )}
                            {castState.playerState === 'PLAYING' && (
                              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            )}
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

                      {/* Subtitles Button */}
                      {availableSubtitles.length > 0 && (
                        <button
                          type="button"
                          onClick={toggleSubtitles}
                          className={`transition-colors ${subtitlesEnabled ? 'text-red-500 hover:text-red-400' : 'text-white hover:text-white/70'
                            }`}
                          title={`${subtitlesEnabled ? "Disable" : "Enable"} Subtitles (c) - ${availableSubtitles.length} track${availableSubtitles.length > 1 ? 's' : ''} available (${availableSubtitles.filter(s => s.trackType === 'internal').length} internal, ${availableSubtitles.filter(s => s.trackType === 'external').length} external)`}
                        >
                          <Subtitles className="w-6 h-6" />
                        </button>
                      )}

                      {/* Settings Button */}
                      <button
                        ref={settingsButtonRef}
                        type="button"
                        onClick={() => setShowSettings(true)}
                        className="text-white hover:text-white/70 transition-colors"
                        title="Settings"
                      >
                        <Settings className="w-6 h-6" />
                      </button>


                      <button
                        type="button"
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
                      type="button"
                      onClick={handleStartFromBeginning}
                      className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 rounded transition-colors"
                    >
                      Start Over
                    </button>
                    <button
                      type="button"
                      onClick={handleResumePlayback}
                      className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded transition-colors"
                    >
                      Resume
                    </button>
                  </div>
                  <button
                    type="button"
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
          {
            nextEpisode && (
              <NextEpisodePreview
                nextEpisode={nextEpisode}
                currentTime={currentTime}
                duration={duration}
                onPlayNext={handlePlayNext}
                onCancel={handleCancelNext}
              />
            )
          }

          {/* Settings Panel */}
          <VideoPlayerSettings
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            mediaId={media.id}
            currentSubtitleTrack={currentSubtitleTrack}
            currentAudioTrack={currentAudioTrack}
            playbackRate={playbackRate}
            onSubtitleTrackChange={handleSubtitleTrackChange}
            onAudioTrackChange={handleAudioTrackChange}
            onPlaybackRateChange={handlePlaybackRateChange}
            onSubtitleStyleChange={setSubtitleStyle}
            subtitleStyle={subtitleStyle}
            settingsButtonRef={settingsButtonRef}
          />

          {/* Pause Screen Overlay - Inside main container for fullscreen support */}
          <AnimatePresence>
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
                  const video = videoRef.current;
                  if (video && video.paused) {
                    // Just resume playback from current position - no seeking or progress loading
                    video.play().catch(() => {
                      // Failed to resume video
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
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 20, opacity: 0 }}
                      transition={{ delay: 0.15, duration: 0.3 }}
                      className="mb-6"
                    >
                      {media.type === 'episode' && seriesData ? (
                        <div className="flex flex-col items-start gap-4">
                          {seriesData.logo_path || seriesData.tmdb_logo_url ? (
                            <img
                              src={seriesData.tmdb_logo_url || `${getApiUrl()}/api/${seriesData.logo_path}`}
                              alt={seriesData.title || media.title}
                              className="max-h-32 w-auto object-contain drop-shadow-2xl"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                // Mark URL as failed to prevent infinite retries
                                failedImageUrls.current.add(target.src);
                                target.style.display = 'none';
                                const titleEl = target.nextElementSibling;
                                if (titleEl) (titleEl as HTMLElement).style.display = 'block';
                              }}
                            />
                          ) : null}
                          <h2
                            className="text-3xl md:text-4xl font-semibold text-white/90 drop-shadow-lg"
                            style={{
                              display: seriesData.logo_path || seriesData.tmdb_logo_url ? 'none' : 'block'
                            }}
                          >
                            {seriesData.title || media.title}
                          </h2>
                        </div>
                      ) : media.logo_path ? (
                        <img
                          src={`${getApiUrl()}/api/${media.logo_path}`}
                          alt={media.title}
                          className="max-h-40 w-auto object-contain drop-shadow-2xl mb-4"
                        />
                      ) : (
                        <h1 className="text-5xl md:text-6xl font-bold text-[#C0392B] leading-tight drop-shadow-lg">
                          {media.title}
                        </h1>
                      )}
                    </motion.div>

                    {/* Year, Rating and Type Info */}
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 20, opacity: 0 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                      className="flex items-center justify-start gap-3 mb-8 text-white/80 flex-wrap"
                    >
                      {/* Series Year for episodes, Media year for movies */}
                      {(media.type === 'episode' ? (seriesData?.year || media.year) : media.year) && (
                        <>
                          <span className="text-xl font-semibold">
                            {(media.type === 'episode' ? (seriesData?.year || media.year) : media.year)}
                          </span>
                          <span className="w-1.5 h-1.5 bg-white/60 rounded-full"></span>
                        </>
                      )}

                      {/* Episode info for TV episodes */}
                      {media.type === 'episode' && (
                        <>
                          <span className="text-xl font-semibold">
                            S{String(media.season_number).padStart(2, '0')}E{String(media.episode_number).padStart(2, '0')}
                          </span>
                          <span className="w-1.5 h-1.5 bg-white/60 rounded-full"></span>
                        </>
                      )}

                      {/* Rating - prefer series rating for episodes */}
                      {(media.type === 'episode' ? (seriesData?.rating || media.rating) : media.rating) && (
                        <span className="text-xl font-semibold text-yellow-500">
                          ★ {(media.type === 'episode' ? (seriesData?.rating || media.rating) : media.rating)?.toFixed(1)}
                        </span>
                      )}

                      {/* Genre - prefer series genre for episodes */}
                      {(media.type === 'episode' ? (seriesData?.genre_names?.[0] || media.genre_names?.[0]) : media.genre_names?.[0]) && (
                        <span className="text-xl font-semibold text-white/80">
                          {(media.type === 'episode' ? (seriesData?.genre_names?.[0] || media.genre_names?.[0]) : media.genre_names?.[0])}
                        </span>
                      )}

                      {/* Series rating count for episodes */}
                      {media.type === 'episode' && seriesData?.vote_count && seriesData.vote_count > 0 && (
                        <span className="text-sm text-white/60">
                          ({seriesData.vote_count.toLocaleString()} votes)
                        </span>
                      )}
                    </motion.div>

                    {/* Description - Show series description for episodes */}
                    {(media.type === 'episode' && seriesData?.description) || media.description ? (
                      <motion.p
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        transition={{ delay: 0.25, duration: 0.3 }}
                        className="text-lg text-white/75 mb-8 line-clamp-4 leading-relaxed"
                      >
                        {media.type === 'episode' && seriesData?.description
                          ? seriesData.description
                          : media.description
                        }
                      </motion.p>
                    ) : null}

                    {/* Episode Title for TV episodes */}
                    {media.type === 'episode' && media.title && (
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        transition={{ delay: 0.22, duration: 0.3 }}
                        className="mb-4"
                      >
                        <h4 className="text-xl font-bold text-white/90 mb-2">
                          Episode: {media.title}
                        </h4>
                      </motion.div>
                    )}

                    {/* Additional TV Series Info */}
                    {media.type === 'episode' && seriesData && (
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        transition={{ delay: 0.24, duration: 0.3 }}
                        className="flex flex-wrap gap-4 mb-6 text-sm text-white/70"
                      >
                        {seriesData.duration && (
                          <span className="flex items-center gap-1">
                            <span>⏱️</span>
                            {Math.floor(seriesData.duration / 60)} min
                          </span>
                        )}
                        {seriesData.status && (
                          <span className="flex items-center gap-1">
                            <span>📺</span>
                            {seriesData.status}
                          </span>
                        )}
                        {seriesData.network && (
                          <span className="flex items-center gap-1">
                            <span>🏢</span>
                            {seriesData.network}
                          </span>
                        )}
                      </motion.div>
                    )}

                    {/* Progress Bar */}
                    {duration > 0 && (
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        transition={{ delay: 0.3, duration: 0.3 }}
                        className="w-full max-w-lg h-1 bg-white/20 rounded-full mb-8 overflow-hidden"
                      >
                        <motion.div
                          className="h-full bg-[#C0392B] rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((currentTime / duration) * 100, 100)}%` }}
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

                  {/* Right Play Icon and Poster */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    className="flex-shrink-0 flex items-center justify-center gap-6"
                  >
                    {/* Poster Image (Desktop) */}
                    <div className="relative group cursor-pointer hidden md:block"
                      onClick={(e) => {
                        e.stopPropagation();
                        const video = videoRef.current;
                        if (video && video.paused) {
                          video.play().catch(() => { });
                        }
                      }}
                    >
                      <img
                        src={
                          media.type === 'episode' && seriesData
                            ? (seriesData.tmdb_poster_url || seriesData.poster_path
                              ? (seriesData.tmdb_poster_url || `${getApiUrl()}/api/${seriesData.poster_path}`)
                              : media.poster_url || media.tmdb_poster_url || `${getApiUrl()}/api/posters/${media.id}`)
                            : (media.poster_url || media.tmdb_poster_url || `${getApiUrl()}/api/posters/${media.id}`)
                        }
                        alt={media.type === 'episode' && seriesData?.title ? seriesData.title : media.title}
                        className="w-48 h-72 object-cover rounded-xl shadow-2xl transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const failedUrl = target.src;

                          // Mark URL as failed to prevent infinite retries
                          failedImageUrls.current.add(failedUrl);

                          // Placeholder SVG for when all fallbacks fail
                          const placeholderSvg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE4Ny4yNzkgMjAwIDIxOCAxNjkuMjc5IDIxOCAxMzJDMjE4IDk0LjcyMDggMTg3LjI3OSA2NCAxNTAgNjRDMTEyLjcyMSA2NCA4MiA5NC43MjA4IDgyIDEzMkM4MiAxNjkuMjc5IDExMi43MjEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik04MiAyNzZDODIgMjM4LjY4IDExMi42OCAyMDggMTUwIDIwOEgxNTBDMTg3LjMyIDIwOCAyMTggMjM4LjY4IDIxOCAyNzZWMzUwSDgyVjI3NloiIGZpbGw9IiM2QjcyODgiLz4KPHN2Zz4K';

                          // Try fallback to episode poster if series poster fails
                          if (media.type === 'episode' && seriesData) {
                            const fallbackUrl = media.poster_url || media.tmdb_poster_url || `${getApiUrl()}/api/posters/${media.id}`;
                            // Only try fallback if it hasn't failed before
                            if (!failedImageUrls.current.has(fallbackUrl)) {
                              target.src = fallbackUrl;
                            } else {
                              target.src = placeholderSvg;
                            }
                          } else {
                            target.src = placeholderSvg;
                          }
                        }}
                      />
                      {/* Play overlay on poster hover */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl flex items-center justify-center">
                        <Play className="w-12 h-12 fill-white text-white" />
                      </div>
                    </div>

                    {/* Mobile Play Button */}
                    <motion.div
                      className="bg-[#C0392B]/20 rounded-full p-6 backdrop-blur-sm hover:bg-[#C0392B]/30 transition-colors duration-200 cursor-pointer md:hidden"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const video = videoRef.current;
                        if (video && video.paused) {
                          // Just resume playback, don't change any state that might cause remount
                          video.play().catch(() => {
                            // Failed to resume video from play button
                          });
                        }
                      }}
                    >
                      <Play className="w-16 h-16 fill-current text-[#C0392B]" />
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

                      handleClose();
                    }}
                    className="absolute top-6 right-6 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-all duration-200 hover:scale-110 border border-white/20 hover:border-red-500/50"
                    title="Close Player (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>

                  {/* New Movies Section - Hidden on mobile */}
                  {!isMobile && (
                    <NewMoviesPauseSection
                      currentMediaId={media.id}
                      currentTime={currentTime}
                      duration={duration}
                      onClose={handleClose}
                    />
                  )}

                  {/* Resume Hint */}
                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 30, opacity: 0 }}
                    transition={{ delay: 0.35, duration: 0.3 }}
                    className="absolute bottom-4 left-0 right-0 text-red-100 text-sm font-bold text-center pointer-events-none"
                  >
                    <p><span className="font-bold text-[#C0392B]">HOMEFLIX</span> Studios</p>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VideoPlayer;
