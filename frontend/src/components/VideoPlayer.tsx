"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, RotateCw, X, Minimize, Subtitles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '@/lib/api';
import RedLoader from './RedLoader';

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



  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
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
  const progressSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const getStreamUrl = (mediaId: number, quality?: string, format?: string) => {
    const baseUrl = `${getApiUrl()}/api/stream/${mediaId}`;
    const params = new URLSearchParams();

    // Ultra-enhanced Netflix-level optimization parameters
    params.set('optimize', 'netflix-level');
    params.set('buffer', 'ultra-aggressive');
    params.set('latency', 'zero');
    params.set('preload', 'instant');

    // Bandwidth detection and hints
    const connection = (navigator as any).connection;
    if (connection) {
      params.set('bandwidth-hint', (connection.downlink * 1024 * 1024).toString());
      params.set('network-type', connection.effectiveType || 'unknown');
    }

    if (quality) {
      params.set('quality', quality);
    } else {
      // Enhanced auto-detect quality based on device and network
      const userAgent = navigator.userAgent.toLowerCase();
      const isLocalNetwork = window.location.hostname === 'localhost' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.startsWith('172.');

      if (isLocalNetwork) {
        // Ultra-high quality for local network
        if (userAgent.includes('mobile')) {
          params.set('quality', '1080p'); // 1080p for mobile on local network
        } else {
          params.set('quality', '4k-ultra'); // Ultra 4K for desktop on local network
        }
      } else {
        if (userAgent.includes('mobile')) {
          params.set('quality', 'high');
        } else {
          params.set('quality', '4k');
        }
      }
    }

    if (format) {
      params.set('format', format);
    }

    // Enhanced device-specific optimizations
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('mac')) {
      params.set('device', 'mac');
      params.set('hardware-accel', 'videotoolbox');
    } else if (userAgent.includes('windows')) {
      params.set('device', 'windows');
      params.set('hardware-accel', 'dxva');
    } else if (userAgent.includes('linux')) {
      params.set('device', 'linux');
      params.set('hardware-accel', 'vaapi');
    } else if (userAgent.includes('ios')) {
      params.set('device', 'ios');
      params.set('hardware-accel', 'metal');
    } else if (userAgent.includes('android')) {
      params.set('device', 'android');
      params.set('hardware-accel', 'mediacodec');
    }

    // Screen resolution optimization
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    params.set('screen-resolution', `${screenWidth}x${screenHeight}`);

    // Memory and performance hints
    const memory = (navigator as any).deviceMemory;
    if (memory) {
      params.set('device-memory', memory.toString());
    }

    return `${baseUrl}?${params.toString()}`;
  };

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      setIsMobile(/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase()));
    };
    checkMobile();
  }, []);

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
      // Always ensure sound is on when playing
      video.muted = false;
      video.volume = volume > 0 ? volume : 0.8;
      setIsMuted(false);
      video.play().catch(error => {
        console.log('Play failed:', error);
      });
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
    const video = videoRef.current;
    const container = containerRef.current;

    if (!container || !video) return;

    // For iOS Safari, use video element fullscreen
    if (isMobile && (video as any).webkitEnterFullscreen) {
      try {
        if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
          (video as any).webkitEnterFullscreen();
          setIsFullscreen(true);
        } else {
          if ((document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen();
          }
          setIsFullscreen(false);
        }
        return;
      } catch (error) {
        console.log('iOS fullscreen failed, trying standard method:', error);
      }
    }

    // Standard fullscreen API
    if (!document.fullscreenElement) {
      const requestFullscreen = container.requestFullscreen ||
        (container as any).webkitRequestFullscreen ||
        (container as any).mozRequestFullScreen ||
        (container as any).msRequestFullscreen;

      if (requestFullscreen) {
        requestFullscreen.call(container).then(() => {
          setIsFullscreen(true);
          // Lock orientation on mobile
          if (screen.orientation && (screen.orientation as any).lock) {
            (screen.orientation as any).lock('landscape').catch(() => { });
          }
        }).catch((error: any) => {
          console.error('Fullscreen request failed:', error);
        });
      }
    } else {
      const exitFullscreen = document.exitFullscreen ||
        (document as any).webkitExitFullscreen ||
        (document as any).mozCancelFullScreen ||
        (document as any).msExitFullscreen;

      if (exitFullscreen) {
        exitFullscreen.call(document).then(() => {
          setIsFullscreen(false);
          if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
          }
        }).catch(console.error);
      }
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

    // Ensure minimum volume of 0.1 to keep sound audible
    const adjustedVolume = Math.max(0.1, newVolume);

    video.volume = adjustedVolume;
    setVolume(adjustedVolume);
    setIsMuted(false); // Never mute through volume control
    video.muted = false;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const progressBar = e.currentTarget;
    if (!video || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clickX = clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    const newTime = percentage * duration;

    video.currentTime = newTime;
    setCurrentTime(newTime);
    
    // Save progress immediately when clicking progress bar
    if (video.duration > 0) {
      updatePlaybackProgress(media.id, newTime, video.duration, '1').catch(error => {
        console.log('Failed to save progress after progress click:', error);
      });
    }
  };

  const handleSeekStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStartTime(currentTime);

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const video = videoRef.current;
      if (!video || !duration) return;

      const progressBar = (e.target as HTMLElement).closest('.progress-container');
      if (!progressBar) return;

      const rect = progressBar.getBoundingClientRect();
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const clickX = clientX - rect.left;
      const width = rect.width;
      const percentage = Math.max(0, Math.min(1, clickX / width));
      const newTime = percentage * duration;

      setCurrentTime(newTime);
      video.currentTime = newTime;
    };

    const handleEnd = () => {
      setIsDragging(false);
      setDragStartTime(null);
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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = (parseFloat(e.target.value) / 100) * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
    
    // Save progress immediately when seeking
    if (video.duration > 0) {
      updatePlaybackProgress(media.id, newTime, video.duration, '1').catch(error => {
        console.log('Failed to save progress after seek:', error);
      });
    }
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

  // Ensure user interaction for autoplay policy
  useEffect(() => {
    const handleUserInteraction = () => {
      const video = videoRef.current;
      if (video && video.paused) {
        video.muted = false;
        video.volume = volume;
        setIsMuted(false);
        video.play().catch(console.log);
      }
    };

    // Add interaction listeners
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, [volume]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = async () => {
      console.log('Video metadata loaded, duration:', video.duration);
      setDuration(video.duration);

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

        if (resumeTimeValue > 30 && resumeTimeValue < video.duration - 30) { // Don't resume if less than 30 seconds watched or less than 30 seconds left
          setResumeTime(resumeTimeValue);
          setShowResumeNotification(true);
          console.log(`Found saved progress at ${resumeTimeValue} seconds`);

          // Auto-hide notification after 10 seconds
          setTimeout(() => {
            setShowResumeNotification(false);
          }, 10000);
        } else if (startTime > 0) {
          // Use provided start time even if no saved progress
          setResumeTime(startTime);
          setShowResumeNotification(true);
          console.log(`Using provided start time: ${startTime} seconds`);

          setTimeout(() => {
            setShowResumeNotification(false);
          }, 10000);
        }
      } catch (error) {
        console.log('No saved progress found or error loading progress:', error);
        // Use provided start time if available
        if (startTime > 0 && startTime < video.duration - 30) {
          setResumeTime(startTime);
          setShowResumeNotification(true);
          console.log(`Using provided start time (no saved progress): ${startTime} seconds`);

          setTimeout(() => {
            setShowResumeNotification(false);
          }, 10000);
        }
      }
    };

    const handleLoadedData = () => {
      console.log('Video data loaded successfully');
      setIsLoading(false);
      // Ensure video is ready to play with sound
      if (video.readyState >= 2) {
        video.volume = volume;
        video.muted = false; // Always unmuted for video player
        setIsMuted(false);
      }
    };

    const handleCanPlay = () => {
      console.log('Video can play');
      setIsLoading(false);
      setIsBuffering(false);
      // Auto-play with sound when ready
      video.muted = false;
      video.volume = volume;
      setIsMuted(false);

      video.play().catch(error => {
        console.log('Auto-play with sound failed, trying muted first:', error);
        // If autoplay with sound fails, try muted then unmute
        video.muted = true;
        video.play().then(() => {
          // Immediately unmute after successful muted play
          setTimeout(() => {
            video.muted = false;
            video.volume = volume;
            setIsMuted(false);
            console.log('Video playing with sound after muted start');
          }, 100);
        }).catch(mutedError => {
          console.log('Even muted autoplay failed:', mutedError);
        });
      });
    };

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(video.currentTime);
        // Update playback progress every 5 seconds for better accuracy
        if (Math.floor(video.currentTime) % 5 === 0 && video.duration > 0) {
          updatePlaybackProgress(media.id, video.currentTime, video.duration, '1').catch(error => {
            console.log('Failed to update playback progress:', error);
          });
        }
      }
    };

    const saveProgressNow = () => {
      if (video.duration > 0) {
        updatePlaybackProgress(media.id, video.currentTime, video.duration, '1').catch(error => {
          console.log('Failed to save progress:', error);
        });
      }
    };

    const handlePlay = () => {
      console.log('Video started playing');
      setIsPlaying(true);

      // Ensure sound is on when playing
      if (video.muted) {
        video.muted = false;
        video.volume = volume;
        setIsMuted(false);
      }

      // Start periodic progress saving every 10 seconds
      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current);
      }
      progressSaveIntervalRef.current = setInterval(saveProgressNow, 10000);

      // Track view when playback starts
      trackView(media.id).catch(error => {
        console.log('Failed to track view:', error);
      });
    };

    const handlePause = () => {
      console.log('Video paused');
      setIsPlaying(false);
      
      // Clear periodic progress saving
      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current);
      }
      
      // Save progress immediately when paused
      saveProgressNow();
    };

    const handleEnded = () => {
      console.log('Video ended');
      setIsPlaying(false);
      
      // Clear periodic progress saving
      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current);
      }
      
      // Mark as completed when ended
      if (video.duration > 0) {
        updatePlaybackProgress(media.id, video.duration, video.duration, '1').catch(error => {
          console.log('Failed to update playback progress on end:', error);
        });
      }

      // Show next episode if available
      if (nextEpisode) {
        setShowNextEpisode(true);
      }
    };

    const handleError = (e: Event) => {
      console.error('Video error:', e);
      const error = (e.target as HTMLVideoElement).error;
      if (error) {
        console.error('Video error details:', {
          code: error.code,
          message: error.message
        });
      }
    };

    const handleWaiting = () => {
      console.log('Video is buffering...');
      setIsBuffering(true);
    };

    const handleCanPlayThrough = () => {
      console.log('Video can play through without buffering');
      setIsBuffering(false);
      setIsLoading(false);
    };

    const handleSeeking = () => {
      setIsBuffering(true);
    };

    const handleSeeked = () => {
      setIsBuffering(false);
    };

    const handleLoadStart = () => {
      console.log('Video loading started');
      setIsLoading(true);
      setIsBuffering(true);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('loadstart', handleLoadStart);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('loadstart', handleLoadStart);
    };
  }, [isDragging, media.id, startTime, volume, isMuted, nextEpisode]);

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

  // Cleanup and save progress when component unmounts or video player closes
  useEffect(() => {
    return () => {
      // Clear progress saving interval
      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current);
      }
      
      // Save final progress before unmounting
      const video = videoRef.current;
      if (video && video.duration > 0 && video.currentTime > 0) {
        updatePlaybackProgress(media.id, video.currentTime, video.duration, '1').catch(error => {
          console.log('Failed to save final progress:', error);
        });
      }
    };
  }, [media.id]);

  // Save progress when video player closes
  useEffect(() => {
    if (!isOpen && progressSaveIntervalRef.current) {
      clearInterval(progressSaveIntervalRef.current);
      
      // Save progress before closing
      const video = videoRef.current;
      if (video && video.duration > 0 && video.currentTime > 0) {
        updatePlaybackProgress(media.id, video.currentTime, video.duration, '1').catch(error => {
          console.log('Failed to save progress on close:', error);
        });
      }
    }
  }, [isOpen, media.id]);

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
          className="w-full h-full object-contain bg-black"
          onPlay={() => setIsPlaying(true)}
          autoPlay
          controls={false}
          playsInline
          webkit-playsinline="true"
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={(e) => {
            console.error('Video error:', e);
            console.log('Video src:', getStreamUrl(media.id));
          }}
          onClick={(e) => {
            // Ensure sound is always on when clicking video
            if (videoRef.current) {
              const video = videoRef.current;
              video.muted = false;
              video.volume = volume > 0 ? volume : 0.8;
              setIsMuted(false);

              if (video.paused) {
                video.play().catch(error => {
                  console.log('Play failed on click:', error);
                });
              }
            }
          }}
          onLoadStart={() => {
            console.log('Video loading started');
            setIsLoading(true);
            setIsBuffering(true);
          }}
          onCanPlay={() => {
            console.log('Video can play');
            setIsLoading(false);
            setIsBuffering(false);
          }}
          onLoadedData={() => {
            console.log('Video loaded successfully');
            setIsLoading(false);
            const video = videoRef.current;
            if (video) {
              // Ensure video is properly initialized with sound
              video.volume = volume;
              video.muted = false; // Always start unmuted
              setIsMuted(false);
              if (startTime > 0) {
                video.currentTime = startTime;
                console.log(`Resuming playback from ${startTime} seconds`);
              }
            }
          }}
          preload="auto"
          muted={false}
          crossOrigin="anonymous"
        >
          {/* Ultra-enhanced multi-source strategy with instant loading */}
          <source src={getStreamUrl(media.id, '4k-ultra', 'mp4')} type="video/mp4; codecs=&quot;avc1.640028, mp4a.40.2&quot;" />
          <source src={getStreamUrl(media.id, '4k', 'mp4')} type="video/mp4; codecs=&quot;avc1.42E01E, mp4a.40.2&quot;" />
          <source src={getStreamUrl(media.id, 'high', 'webm')} type="video/webm; codecs=&quot;vp9.2, opus&quot;" />
          <source src={getStreamUrl(media.id, 'high', 'mp4')} type="video/mp4; codecs=&quot;avc1.42E01E, mp4a.40.2&quot;" />
          <source src={getStreamUrl(media.id, 'medium', 'webm')} type="video/webm; codecs=&quot;vp9, opus&quot;" />
          <source src={getStreamUrl(media.id, 'medium', 'mp4')} type="video/mp4" />
          <source src={getStreamUrl(media.id, 'low', 'mp4')} type="video/mp4" />

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
                    className="progress-container relative w-full h-1 bg-white/30 rounded-lg cursor-pointer group-hover:h-2 transition-all duration-200"
                    onClick={handleProgressClick}
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
                      style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                    />

                    {/* Progress Handle */}
                    <div
                      className={`absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-red-600 rounded-full transition-all duration-200 pointer-events-none ${isDragging || isBuffering ? 'opacity-100 scale-125' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                    />

                    {/* Buffering indicator */}
                    {isBuffering && (
                      <div
                        className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 border-2 border-white/30 border-t-red-600 rounded-full animate-spin pointer-events-none"
                        style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      />
                    )}
                  </div>

                  {/* Time tooltip on hover */}
                  <div className="relative">
                    <div className="absolute bottom-2 left-0 right-0 pointer-events-none">
                      <div
                        className={`absolute bg-black/80 text-white text-xs px-2 py-1 rounded transition-opacity duration-200 transform -translate-x-1/2 ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      >
                        {formatTime(currentTime)}
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

                    <div className="flex items-center gap-4">
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

                      {/* Volume Slider */}
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={isMuted ? 0 : volume * 100}
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
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
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
    </AnimatePresence>
  );
};

export default VideoPlayer;
