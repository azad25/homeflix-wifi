"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Tv } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useNavigate } from "@/hooks/useNavigate";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const VIDEOS_PER_BATCH = 5;

  // Fetch videos from API
  const fetchVideos = useCallback(async (page: number, random: boolean = false) => {
    try {
      setIsLoading(true);
      const apiUrl = getApiUrl();
      const randomParam = random ? "&random=true" : "";
      const response = await fetch(
        `${apiUrl}/api/now-playing/previews?page=${page}&limit=${VIDEOS_PER_BATCH}${randomParam}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: NowPlayingResponse = await response.json();

      if (data.videos && data.videos.length > 0) {
        // Convert relative URLs to full URLs
        const videosWithFullUrls = data.videos.map(video => ({
          ...video,
          url: `${apiUrl}${video.url}`
        }));

        setVideos(videosWithFullUrls);
        setTotalVideos(data.total);

        // Start from random video index if this is the initial load with random videos
        if (random && videosWithFullUrls.length > 0) {
          const randomIndex = Math.floor(Math.random() * videosWithFullUrls.length);
          setCurrentVideoIndex(randomIndex);
        } else {
          setCurrentVideoIndex(0);
        }

        setError(null);
      } else {
        setError("No preview videos available");
      }
    } catch (err) {
      console.error("Error fetching videos:", err);
      setError("Failed to load preview videos");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load next batch of videos
  const loadNextBatch = useCallback(async () => {
    const nextPage = currentPage + 1;
    const maxPage = Math.ceil(totalVideos / VIDEOS_PER_BATCH);

    if (nextPage > maxPage) {
      // Loop back to random page for variety
      const randomPage = Math.floor(Math.random() * Math.max(1, maxPage)) + 1;
      setCurrentPage(randomPage);
      await fetchVideos(randomPage, true); // Get random videos
    } else {
      setCurrentPage(nextPage);
      await fetchVideos(nextPage, Math.random() > 0.7); // 30% chance of random videos
    }
  }, [currentPage, totalVideos, fetchVideos]);

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

  // Initialize with random videos
  useEffect(() => {
    // Start with random page and random videos
    const randomPage = Math.floor(Math.random() * 10) + 1; // Random page between 1-10
    fetchVideos(randomPage, true); // Request random videos
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
      skipToNextVideo();
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
      }, 8000); // 8 seconds timeout
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
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("loadstart", handleLoadStart);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleVideoEnd);
      video.removeEventListener("stalled", handleStalled);
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

  // Health check system for 24/7 operation
  useEffect(() => {
    const healthCheck = () => {
      const video = videoRef.current;
      if (!video || !currentVideo) return;

      // Check if video is stuck or not progressing
      const currentTime = video.currentTime;
      const duration = video.duration;

      // If video is paused and not ended, try to resume
      if (video.paused && !video.ended) {
        console.log('Health check: Video paused, attempting to resume...');
        video.play().catch(() => {
          console.warn('Health check: Failed to resume, skipping...');
          skipToNextVideo();
        });
      }

      // If video seems stuck at the same position for too long
      if (currentTime > 0 && video.readyState === 4 && video.paused) {
        console.log('Health check: Video appears stuck, restarting...');
        skipToNextVideo();
      }

      // If video duration is very short or invalid, skip it
      if (duration && duration < 5) {
        console.log('Health check: Video too short, skipping...');
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
  }, [currentVideo, skipToNextVideo]);

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
      className={`relative w-full bg-black overflow-hidden ${isFullscreen ? 'h-screen' : 'max-w-6xl mx-auto rounded-lg shadow-2xl'
        }`}
      onMouseMove={handleMouseMove}
      onTouchStart={() => resetControlsTimeout()}
      onMouseLeave={() => setShowControls(false)}
      onClick={() => resetControlsTimeout()}
    >
      {/* Video Player */}
      <div className={`relative bg-black ${isFullscreen ? 'h-full' : 'aspect-video'}`}>
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
        <div className="absolute top-3 right-3 lg:top-6 lg:right-6 z-50">
          <button
            className="text-white hover:text-white text-lg lg:text-xl font-bold tracking-wider drop-shadow-lg transition-colors duration-200 cursor-pointer"
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
                  onClick={togglePlayPause}
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
                      onClick={togglePlayPause}
                      className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-2 lg:p-3 rounded-full transition-colors shadow-lg"
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 lg:w-6 lg:h-6" />
                      ) : (
                        <Play className="w-5 h-5 lg:w-6 lg:h-6" />
                      )}
                    </button>

                    <button
                      onClick={toggleMute}
                      className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-2 lg:p-3 rounded-full transition-colors shadow-lg"
                    >
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 lg:w-6 lg:h-6" />
                      ) : (
                        <Volume2 className="w-5 h-5 lg:w-6 lg:h-6" />
                      )}
                    </button>

                    <button
                      onClick={toggleFullscreen}
                      className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-2 lg:p-3 rounded-full transition-colors shadow-lg"
                    >
                      {isFullscreen ? (
                        <Minimize className="w-5 h-5 lg:w-6 lg:h-6" />
                      ) : (
                        <Maximize className="w-5 h-5 lg:w-6 lg:h-6" />
                      )}
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
      </div>

      {/* Channel Info - Only show when not fullscreen, mobile-responsive */}
      {!isFullscreen && (
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