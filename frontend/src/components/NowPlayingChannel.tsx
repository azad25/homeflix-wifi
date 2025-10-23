"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Tv } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useNavigate } from "@/hooks/useNavigate";
import BreakingNewsTicker from "./BreakingNewsTicker";

interface PreviewVideo {
  id: string;
  title: string;
  filename: string;
  url: string;
}

interface NowPlayingResponse {
  videos: PreviewVideo[];
  total: number;
  page: number;
  limit: number;
}

interface NewsItem {
  id: string;
  text: string;
  source: string;
  time: string;
}

interface NewsResponse {
  items: NewsItem[];
  total: number;
}

const NowPlayingChannel: React.FC = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<PreviewVideo[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalVideos, setTotalVideos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nextVideo, setNextVideo] = useState<PreviewVideo | null>(null);
  const [failedVideos, setFailedVideos] = useState<Set<string>>(new Set());
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [newsLoaded, setNewsLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const newsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const VIDEOS_PER_BATCH = 5;

  // Fetch news for ticker
  const fetchNews = useCallback(async () => {
    try {
      const apiUrl = getApiUrl();
      console.log("Fetching news from:", `${apiUrl}/api/news/ticker`);
      const response = await fetch(`${apiUrl}/api/news/ticker`);

      if (response.ok) {
        const data: NewsResponse = await response.json();
        console.log("News data received:", data);
        console.log("Setting news items:", data.items?.length || 0, "items");
        setNewsItems(data.items || []);
        setNewsLoaded(true);
      } else {
        console.error("News API response not ok:", response.status);
        setNewsLoaded(true); // Still mark as loaded to show fallback
      }
    } catch (err) {
      console.error("Error fetching news:", err);
      setNewsLoaded(true); // Mark as loaded to show fallback
    }
  }, []);

  // Update current time
  const updateClock = useCallback(() => {
    const now = new Date();
    setCurrentTime(now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    }));
  }, []);

  // Fetch videos from API with better error handling and randomization
  const fetchVideos = useCallback(async (page: number, random: boolean = true) => {
    try {
      setIsLoading(true);
      const apiUrl = getApiUrl();
      const randomParam = random ? "&random=true" : "";

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${apiUrl}/api/now-playing/previews?page=${page}&limit=${VIDEOS_PER_BATCH}${randomParam}&t=${Date.now()}`,
        {
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: NowPlayingResponse = await response.json();

      if (data.videos && data.videos.length > 0) {
        // Convert relative URLs to full URLs and shuffle for better randomization
        let videosWithFullUrls = data.videos.map(video => ({
          ...video,
          url: `${apiUrl}${video.url}`
        }));

        // Always shuffle videos for better randomization
        videosWithFullUrls = videosWithFullUrls.sort(() => Math.random() - 0.5);

        setVideos(videosWithFullUrls);
        setTotalVideos(data.total);

        // Always start from random index for better variety
        const randomIndex = Math.floor(Math.random() * videosWithFullUrls.length);
        setCurrentVideoIndex(randomIndex);

        setError(null);

        // Clear failed videos list periodically to allow retry
        if (failedVideos.size > 10) {
          setFailedVideos(new Set());
        }
      } else {
        setError("No preview videos available");
      }
    } catch (err) {
      console.error("Error fetching videos:", err);
      if (err instanceof Error && err.name === 'AbortError') {
        setError("Request timeout - retrying...");
      } else {
        setError("Failed to load preview videos");
      }
    } finally {
      setIsLoading(false);
    }
  }, [failedVideos.size]);

  // Load next batch of videos with better randomization
  const loadNextBatch = useCallback(async () => {
    const maxPage = Math.ceil(totalVideos / VIDEOS_PER_BATCH);

    // Always use random pages for better variety
    const randomPage = Math.floor(Math.random() * Math.max(1, maxPage)) + 1;
    setCurrentPage(randomPage);

    // Always fetch with randomization enabled
    await fetchVideos(randomPage, true);
  }, [totalVideos, fetchVideos]);

  // Skip to next valid video
  const skipToNextVideo = useCallback(async () => {
    console.log('Skipping to next video...');

    // Clear any existing error timeout
    if (videoErrorTimeoutRef.current) {
      clearTimeout(videoErrorTimeoutRef.current);
    }

    if (currentVideoIndex < videos.length - 1) {
      // Move to next video in current batch
      setCurrentVideoIndex(prev => prev + 1);
    } else {
      // Load next batch
      console.log('Loading next batch...');
      await loadNextBatch();
    }


  }, [currentVideoIndex, videos.length, loadNextBatch]);

  // Handle video end - move to next video or load next batch
  const handleVideoEnd = useCallback(async () => {
    console.log('Video ended normally, moving to next...');
    await skipToNextVideo();
  }, [skipToNextVideo]);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2000); // Shorter timeout for TV experience
  }, []);

  // Handle mouse movement
  const handleMouseMove = useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
    resetControlsTimeout();
  }, [isPlaying, resetControlsTimeout]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
    resetControlsTimeout();
  }, [isMuted, resetControlsTimeout]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any).webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen();
        } else if ((containerRef.current as any).msRequestFullscreen) {
          await (containerRef.current as any).msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (error) {
      console.error("Fullscreen toggle failed:", error);
    }
    resetControlsTimeout();
  }, [isFullscreen, resetControlsTimeout]);

  // Handle fullscreen change
  const handleFullscreenChange = useCallback(() => {
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).msFullscreenElement
    );
    setIsFullscreen(isCurrentlyFullscreen);
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key.toLowerCase()) {
      case 'f':
        event.preventDefault();
        toggleFullscreen();
        break;
      case 'escape':
        if (isFullscreen) {
          event.preventDefault();
          toggleFullscreen();
        }
        break;
      case ' ':
      case 'spacebar':
        event.preventDefault();
        togglePlayPause();
        break;
      case 'm':
        event.preventDefault();
        toggleMute();
        break;
      case 'arrowright':
        event.preventDefault();
        skipToNextVideo();
        break;
      default:
        break;
    }
  }, [isFullscreen, toggleFullscreen, togglePlayPause, toggleMute, skipToNextVideo]);

  // Get current video, skipping failed ones
  const getCurrentVideo = useCallback(() => {
    if (videos.length === 0) return null;

    let index = currentVideoIndex;
    let attempts = 0;

    // Try to find a non-failed video
    while (attempts < videos.length) {
      const video = videos[index];
      if (video && !failedVideos.has(video.id)) {
        return video;
      }

      index = (index + 1) % videos.length;
      attempts++;
    }

    // If all videos failed, clear failed list and start over
    if (attempts >= videos.length) {
      console.log('All videos failed, clearing failed list and retrying...');
      setFailedVideos(new Set());
      return videos[currentVideoIndex] || null;
    }

    return null;
  }, [videos, currentVideoIndex, failedVideos]);

  const currentVideo = getCurrentVideo();

  // Initialize with random videos - more robust initialization
  useEffect(() => {
    const initializeVideos = async () => {
      try {
        // Start with random page and random videos
        const randomPage = Math.floor(Math.random() * 20) + 1; // Random page between 1-20 for more variety
        await fetchVideos(randomPage, true); // Request random videos
      } catch (error) {
        console.error('Failed to initialize videos:', error);
        // Retry with page 1 if random page fails
        setTimeout(() => {
          fetchVideos(1, true);
        }, 2000);
      }
    };

    initializeVideos();
  }, [fetchVideos]);

  // Setup video event listeners with simplified error handling
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      console.log('Video loaded, starting playback...');
      video.play().catch(() => {
        console.warn('Failed to play video, skipping...');
        skipToNextVideo();
      });
      setIsPlaying(true);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleError = () => {
      console.error('Video error, skipping to next...');
      if (currentVideo) {
        setFailedVideos((prev: Set<string>) => new Set([...prev, currentVideo.id]));
      }
      // Add small delay to prevent rapid error loops
      setTimeout(() => {
        skipToNextVideo();
      }, 1000);
    };

    const handleStalled = () => {
      console.log('Video stalled, setting timeout to skip...');
      if (videoErrorTimeoutRef.current) {
        clearTimeout(videoErrorTimeoutRef.current);
      }

      videoErrorTimeoutRef.current = setTimeout(() => {
        console.log('Video stalled too long, skipping...');
        if (currentVideo) {
          setFailedVideos((prev: Set<string>) => new Set([...prev, currentVideo.id]));
        }
        skipToNextVideo();
      }, 5000); // Reduced to 5 seconds for faster recovery
    };

    const handleWaiting = () => {
      console.log('Video waiting for data...');
      // Set a timeout for waiting state as well
      if (videoErrorTimeoutRef.current) {
        clearTimeout(videoErrorTimeoutRef.current);
      }

      videoErrorTimeoutRef.current = setTimeout(() => {
        console.log('Video waiting too long, skipping...');
        if (currentVideo) {
          setFailedVideos((prev: Set<string>) => new Set([...prev, currentVideo.id]));
        }
        skipToNextVideo();
      }, 10000); // 10 seconds for waiting
    };

    const handleLoadStart = () => {
      if (videoErrorTimeoutRef.current) {
        clearTimeout(videoErrorTimeoutRef.current);
      }
    };

    video.addEventListener("loadstart", handleLoadStart);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleVideoEnd);
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("loadstart", handleLoadStart);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleVideoEnd);
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("error", handleError);
    };
  }, [handleVideoEnd, skipToNextVideo, currentVideo]);

  // Setup fullscreen event listeners
  useEffect(() => {
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("msfullscreenchange", handleFullscreenChange);
    };
  }, [handleFullscreenChange]);

  // Setup keyboard event listeners
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Setup news fetching with better reliability
  useEffect(() => {
    // Initial fetch
    fetchNews();

    // Fetch news every 90 seconds for more frequent updates
    newsIntervalRef.current = setInterval(() => {
      try {
        fetchNews();
      } catch (error) {
        console.error('Error in news fetch interval:', error);
      }
    }, 90 * 1000);

    return () => {
      if (newsIntervalRef.current) {
        clearInterval(newsIntervalRef.current);
      }
    };
  }, [fetchNews]);

  // Setup clock updates
  useEffect(() => {
    // Initial update
    updateClock();

    // Update every second
    clockIntervalRef.current = setInterval(updateClock, 1000);

    return () => {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
      }
    };
  }, [updateClock]);

  // Enhanced health check system for 24/7 operation with crash prevention
  useEffect(() => {
    let lastCurrentTime = 0;
    let stuckCount = 0;
    let errorCount = 0;

    const healthCheck = () => {
      try {
        const video = videoRef.current;
        if (!video || !currentVideo) return;

        const currentTime = video.currentTime;
        const duration = video.duration;
        const readyState = video.readyState;

        // Check if video is stuck at the same position
        if (currentTime === lastCurrentTime && !video.paused && !video.ended) {
          stuckCount++;
          if (stuckCount >= 2) { // 20 seconds of being stuck (reduced from 30)
            console.log('Health check: Video stuck, skipping...');
            skipToNextVideo();
            stuckCount = 0;
            return;
          }
        } else {
          stuckCount = 0;
        }
        lastCurrentTime = currentTime;

        // If video is paused unexpectedly, try to resume
        if (video.paused && !video.ended && isPlaying) {
          console.log('Health check: Video paused unexpectedly, resuming...');
          video.play().catch(() => {
            console.warn('Health check: Failed to resume, skipping...');
            skipToNextVideo();
          });
        }

        // Check for network stalls with timeout
        if (readyState < 2 && currentTime === 0) {
          console.log('Health check: Video not loading, may skip soon...');
        }

        // If video duration is very short or invalid, skip it
        if (duration && (duration < 3 || isNaN(duration) || !isFinite(duration))) {
          console.log('Health check: Invalid video duration, skipping...');
          skipToNextVideo();
        }

        // Reset error count on successful check
        errorCount = 0;

        // Aggressive memory cleanup for 24/7 operation
        if (Math.random() < 0.2) { // 20% chance each check
          // Force garbage collection if available
          if (window.gc) {
            window.gc();
          }

          // Clear browser caches periodically
          if ('caches' in window) {
            caches.keys().then(names => {
              names.forEach(name => {
                if (name.includes('video') || name.includes('media')) {
                  caches.delete(name);
                }
              });
            }).catch(() => { });
          }
        }

      } catch (error) {
        errorCount++;
        console.error('Health check error:', error);

        // If too many errors, reload the page to prevent crash
        if (errorCount >= 5) {
          console.error('Too many health check errors, reloading page...');
          window.location.reload();
          return;
        }

        skipToNextVideo();
      }
    };

    // Run health check every 10 seconds
    healthCheckIntervalRef.current = setInterval(healthCheck, 10000);

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [currentVideo, skipToNextVideo, isPlaying]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (videoErrorTimeoutRef.current) {
        clearTimeout(videoErrorTimeoutRef.current);
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
      if (newsIntervalRef.current) {
        clearInterval(newsIntervalRef.current);
      }
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
      }
    };
  }, []);

  // Hide controls initially for TV experience
  useEffect(() => {
    setShowControls(false);
  }, []);

  // Preload next video for smooth transitions
  useEffect(() => {
    if (videos.length > 0) {
      const nextIndex = currentVideoIndex + 1;
      if (nextIndex < videos.length) {
        setNextVideo(videos[nextIndex]);
      } else {
        // Next video will be from next batch, clear for now
        setNextVideo(null);
      }
    }
  }, [currentVideoIndex, videos]);

  // Auto-play management - simplified and reliable
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentVideo) return;

    console.log('Setting up video source:', currentVideo.title);

    // Configure video for autoplay
    video.autoplay = true;
    video.muted = isMuted;
    video.preload = 'auto';

    // Simple play attempt with timeout
    const playTimeout = setTimeout(() => {
      if (video.paused) {
        video.play().catch(() => {
          console.warn('Auto-play failed, skipping video...');
          skipToNextVideo();
        });
      }
    }, 2000);

    return () => clearTimeout(playTimeout);
  }, [currentVideo, isMuted, skipToNextVideo]);

  // Auto-skip if current video is in failed list
  useEffect(() => {
    if (currentVideo && failedVideos.has(currentVideo.id)) {
      console.log('Current video is marked as failed, skipping...');
      skipToNextVideo();
    }
  }, [currentVideo, failedVideos, skipToNextVideo]);

  // Enhanced error recovery and crash prevention
  useEffect(() => {
    let errorCount = 0;
    const maxErrors = 10;

    const handleError = (event: ErrorEvent) => {
      errorCount++;
      console.error('Global error caught:', event.error);

      // If too many errors, reload the page
      if (errorCount >= maxErrors) {
        console.error('Too many errors, reloading page for stability...');
        window.location.reload();
        return;
      }

      // Try to recover by skipping to next video
      try {
        skipToNextVideo();
      } catch (e) {
        console.error('Failed to skip video during error recovery:', e);
      }

      // Don't let errors crash the app
      event.preventDefault();
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      errorCount++;
      console.error('Unhandled promise rejection:', event.reason);

      // If too many rejections, reload the page
      if (errorCount >= maxErrors) {
        console.error('Too many promise rejections, reloading page for stability...');
        window.location.reload();
        return;
      }

      // Try to recover
      try {
        skipToNextVideo();
      } catch (e) {
        console.error('Failed to skip video during promise rejection recovery:', e);
      }

      // Don't let promise rejections crash the app
      event.preventDefault();
    };

    // Reset error count periodically
    const resetErrorCount = setInterval(() => {
      errorCount = Math.max(0, errorCount - 1);
    }, 60000); // Reduce error count by 1 every minute

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      clearInterval(resetErrorCount);
    };
  }, [skipToNextVideo]);

  // Enhanced memory cleanup and crash prevention
  useEffect(() => {
    const memoryCleanup = () => {
      try {
        // Clear failed videos list if it gets too large
        if (failedVideos.size > 20) { // Reduced threshold
          console.log('Clearing failed videos list for memory management');
          setFailedVideos(new Set());
        }

        // Force garbage collection if available
        if (window.gc) {
          window.gc();
        }

        // Clear any stale video elements
        const video = videoRef.current;
        if (video && video.readyState === 0) {
          video.load();
        }

        // Monitor memory usage and reload if too high
        if ('memory' in performance) {
          const memInfo = (performance as any).memory;
          if (memInfo.usedJSHeapSize > memInfo.jsHeapSizeLimit * 0.9) {
            console.warn('High memory usage detected, reloading page...');
            window.location.reload();
          }
        }

      } catch (error) {
        console.error('Memory cleanup error:', error);
      }
    };

    const cleanupInterval = setInterval(memoryCleanup, 3 * 60 * 1000); // Every 3 minutes

    return () => clearInterval(cleanupInterval);
  }, [failedVideos.size]);

  // Page reload safety net for long-running sessions
  useEffect(() => {
    const reloadInterval = setInterval(() => {
      const uptime = Date.now() - performance.timing.navigationStart;
      // Reload after 2 hours to prevent memory leaks and crashes
      if (uptime > 2 * 60 * 60 * 1000) {
        console.log('Reloading page after 2 hours for stability...');
        window.location.reload();
      }
    }, 10 * 60 * 1000); // Check every 10 minutes

    return () => clearInterval(reloadInterval);
  }, []);

  if (isLoading && videos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading HomeFlix TV Channel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">
            <Tv />
          </div>
          <p className="text-white text-xl mb-4">{error}</p>
          <button
            onClick={() => {
              const randomPage = Math.floor(Math.random() * 10) + 1;
              fetchVideos(randomPage, true);
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black overflow-hidden ${isFullscreen ? 'h-screen' : 'h-screen'
        }`}
      onMouseMove={handleMouseMove}
      onTouchStart={() => resetControlsTimeout()}
      onMouseLeave={() => setShowControls(false)}
      onClick={togglePlayPause}
    >
      {/* Video Player */}
      <div className="relative bg-black h-full">
        {currentVideo && (
          <video
            ref={videoRef}
            src={currentVideo.url}
            className="w-full h-full object-cover"
            autoPlay
            muted={isMuted}
            playsInline
            preload="auto"
            loop={false}
            controls={false}
            key={currentVideo.id} // Force re-render on video change
          />
        )}

        {/* Preload next video (hidden) */}
        {nextVideo && (
          <video
            ref={nextVideoRef}
            src={nextVideo.url}
            className="hidden"
            muted
            preload="auto"
            key={`next-${nextVideo.id}`}
          />
        )}

        {/* Loading overlay */}
        {(isLoading || !currentVideo) && (
          <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white text-xl font-light">HOMEFLIX</p>
              {failedVideos.size > 0 && (
                <p className="text-gray-400 text-sm mt-2">
                  Skipping invalid videos... ({failedVideos.size} skipped)
                </p>
              )}
            </div>
          </div>
        )}

        {/* HomeFlix TV Watermark - Always visible, clickable link to home */}
        <div className="absolute top-3 right-3 lg:top-6 lg:right-6 z-40">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate.push("/");
            }}
            className="text-white hover:text-red-400 text-lg lg:text-xl font-bold tracking-wider drop-shadow-lg transition-colors duration-200 cursor-pointer"
          >
            HOMEFLIX
          </button>
        </div>

        {/* Controls Overlay - No background overlay */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 pointer-events-none"
            >
              {/* Center Play Button */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlayPause();
                  }}
                  className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-4 lg:p-6 rounded-full transition-all duration-200 transform hover:scale-110 shadow-lg"
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8 lg:w-12 lg:h-12" />
                  ) : (
                    <Play className="w-8 h-8 lg:w-12 lg:h-12 ml-1" />
                  )}
                </button>
              </div>

              {/* Bottom Controls - Minimal and Mobile-Friendly */}
              <div className="absolute bottom-3 left-3 right-3 lg:bottom-6 lg:left-6 lg:right-6 pointer-events-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 lg:gap-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlayPause();
                      }}
                      className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-2 lg:p-3 rounded-full transition-colors shadow-lg"
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 lg:w-6 lg:h-6" />
                      ) : (
                        <Play className="w-5 h-5 lg:w-6 lg:h-6" />
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                      }}
                      className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-2 lg:p-3 rounded-full transition-colors shadow-lg"
                    >
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 lg:w-6 lg:h-6" />
                      ) : (
                        <Volume2 className="w-5 h-5 lg:w-6 lg:h-6" />
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        skipToNextVideo();
                      }}
                      className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-2 lg:p-3 rounded-full transition-colors shadow-lg"
                      title="Next Video (→)"
                    >
                      <span className="text-xs lg:text-sm font-bold">NEXT</span>
                    </button>
                  </div>

                  <div className="bg-black bg-opacity-60 rounded-full px-3 py-1 lg:px-4 lg:py-2 shadow-lg">
                    <div className="flex items-center gap-1 lg:gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-white text-xs lg:text-sm font-light">LIVE</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Breaking News Ticker - Always visible overlay */}
        <BreakingNewsTicker
          newsItems={newsItems}
          currentTime={currentTime}
          isFullscreen={true}
        />
      </div>

      {/* Channel Info - Only show when not fullscreen, mobile-responsive */}
      {false && (
        <div className="bg-gray-900 p-3 lg:p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-red text-lg lg:text-xl font-bold mb-1">
                <button
                  onClick={() => navigate.push("/")}
                  className="text-red-500 hover:text-red-400 text-xl lg:text-2xl font-bold tracking-wider drop-shadow-lg transition-colors duration-200 cursor-pointer">
                  HomeFlix TV
                </button></h2>
              <p className="text-gray-400 text-xs lg:text-sm truncate">
                Live streaming • {totalVideos} videos in rotation • Tap for controls
              </p>
            </div>
            <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0 ml-2">
              <div className="w-2 h-2 lg:w-3 lg:h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-500 text-xs lg:text-sm font-semibold">LIVE</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NowPlayingChannel;