"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Play, Plus, Check, Share, Download, Info, Star, Clock, Calendar, Globe, Users, Award, Film, Tv, User, Mic, ChevronDown, ChevronUp, Volume2, VolumeX, Users as Cast, User as Director } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from 'next/image';
import { Media } from '@/types/media';
import { getApiUrl, getAssetUrl } from '@/lib/api';
import RedLoader from '@/components/RedLoader';
import LazyImage from '@/components/LazyImage';
import LazyVideo from '@/components/LazyVideo';
import { updatePlaybackProgress, getPlaybackProgress } from '@/lib/playback';
import Navbar from '@/components/Navbar';
import { cleanMovieTitle, findSimilarMovies } from '@/lib/titleUtils';
import VideoPlayer from '@/components/VideoPlayer';
import GenreTitle from '@/components/GenreTitle';
import QualityBadge from '../../../components/QualityBadge';
import { addToWishlist, removeFromWishlist, isInWishlist } from '@/lib/wishlist';
import CastButton from '@/components/CastButton';
import { useChromecast, CastMedia } from '@/hooks/useChromecast';
import ImageWithFallback from '@/components/ImageWithFallback';

import {
  NetflixHorizontalRow,
  ParallaxSection,
  ScrollReveal,
  GlassCard,
  GradientBackground,
  FloatingElement,
  MagneticButton,
  ParticleField
} from '@/components/scrollx';
import RecommendationSection from '@/components/RecommendationSection';
import DynamicTitle from '@/components/DynamicTitle';
import { useNavigate } from "@/hooks/useNavigate";

export default function MoviePage() {
  const params = useParams();
  const router = useRouter();
  const navigate = useNavigate();
  const [media, setMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isInMyList, setIsInMyList] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [hasWatchedBefore, setHasWatchedBefore] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [lastWatched, setLastWatched] = useState<string | null>(null);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false); // Start with audio enabled
  const [showTitleOverlay, setShowTitleOverlay] = useState(true); // Netflix-style title overlay
  const [isHoveringTitle, setIsHoveringTitle] = useState(false); // Hover state for title area
  const videoRef = useRef<HTMLVideoElement>(null);

  // Chromecast integration
  const {
    castState,
    connect: connectToCast,
    disconnect: disconnectFromCast,
    loadMedia: loadCastMedia,
  } = useChromecast();

  useEffect(() => {
    if (params.id) {
      fetchMedia();
      checkMyList();
      loadPlaybackProgress();
    }
  }, [params.id]);

  // Effect to handle background video when player opens/closes
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      if (isPlayerOpen) {
        // Pause and mute background video when player opens
        video.pause();
        video.muted = true;
        setIsVideoPlaying(false);
        setIsMuted(true);
        console.log('Background video paused and muted due to player opening');
      }
    }
  }, [isPlayerOpen]);

  // Aggressive auto-play with multiple triggers
  useEffect(() => {
    const forceVideoPlay = () => {
      const video = videoRef.current;
      if (video && media && !isPlayerOpen) {
        console.log('Attempting to force video play...');

        // Set video properties
        video.muted = false;
        video.volume = 1.0;
        video.currentTime = 0;
        setIsMuted(false);

        // Force play with multiple attempts
        const playAttempt = () => {
          video.play().then(() => {
            console.log('Background video started playing with sound');
            setIsVideoPlaying(true);
          }).catch((error) => {
            console.log('Play with sound failed, trying muted:', error);
            video.muted = true;
            setIsMuted(true);
            video.play().then(() => {
              console.log('Background video started playing (muted)');
              setIsVideoPlaying(true);
            }).catch(() => {
              console.log('All play attempts failed');
            });
          });
        };

        // Try immediately and with delays
        playAttempt();
        setTimeout(playAttempt, 100);
        setTimeout(playAttempt, 500);
      }
    };

    // Multiple triggers for auto-play
    if (media && !loading) {
      forceVideoPlay();
      const timer1 = setTimeout(forceVideoPlay, 200);
      const timer2 = setTimeout(forceVideoPlay, 1000);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [media, loading, isPlayerOpen]);

  // Additional trigger when video becomes loaded
  useEffect(() => {
    if (isVideoLoaded && !isVideoPlaying && !isPlayerOpen) {
      const video = videoRef.current;
      if (video) {
        console.log('Video loaded, forcing play...');
        video.muted = false;
        video.volume = 1.0;
        video.play().then(() => {
          console.log('Video started after load detection');
          setIsVideoPlaying(true);
          setIsMuted(false);
        }).catch(() => {
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {
            console.log('Failed to start video after load');
          });
        });
      }
    }
  }, [isVideoLoaded, isVideoPlaying, isPlayerOpen]);

  // Cookie-based playback progress management
  const savePlaybackProgress = (mediaId: string, currentTime: number, duration: number) => {
    const progressData = {
      currentTime,
      duration,
      percentage: (currentTime / duration) * 100,
      timestamp: new Date().toISOString(),
      lastWatched: new Date().toISOString()
    };

    // Save to cookie with 30 days expiration
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);

    document.cookie = `playback_${mediaId}=${JSON.stringify(progressData)}; expires=${expirationDate.toUTCString()}; path=/; SameSite=Lax`;

    // Update local state
    setPlaybackProgress(currentTime);
    setPlaybackDuration(duration);
    setHasWatchedBefore(true);
    setLastWatched(progressData.lastWatched);

    console.log(`Saved playback progress for media ${mediaId}: ${Math.round(progressData.percentage)}%`);
  };

  const getPlaybackProgressFromCookie = (mediaId: string) => {
    const cookies = document.cookie.split(';');
    const progressCookie = cookies.find(cookie =>
      cookie.trim().startsWith(`playback_${mediaId}=`)
    );

    if (progressCookie) {
      try {
        const progressData = JSON.parse(progressCookie.split('=')[1]);
        return progressData;
      } catch (error) {
        console.error('Error parsing playback progress cookie:', error);
        return null;
      }
    }
    return null;
  };

  const clearPlaybackProgress = (mediaId: string) => {
    // Clear cookie by setting expiration to past date
    document.cookie = `playback_${mediaId}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;

    // Reset local state
    setPlaybackProgress(0);
    setPlaybackDuration(0);
    setHasWatchedBefore(false);
    setLastWatched(null);

    console.log(`Cleared playback progress for media ${mediaId}`);
  };

  // Netflix-style title overlay animation
  useEffect(() => {
    if (!loading && media) {
      // Start the drop-down animation after a brief delay
      const timer = setTimeout(() => {
        setShowTitleOverlay(false);
      }, 1500); // 1.5 second delay to show title first

      return () => clearTimeout(timer);
    }
  }, [loading, media]);

  const fetchMedia = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/media/${params.id}`);
      const data = await response.json();
      setMedia(data);
    } catch (error) {
      console.error('Error fetching media:', error);
    } finally {
      setLoading(false);
    }
  };



  const checkMyList = async () => {
    if (params.id) {
      const inList = isInWishlist(parseInt(params.id as string));
      setIsInMyList(inList);
    }
  };

  const toggleMyList = async () => {
    try {
      if (!params.id) return;

      const mediaId = parseInt(params.id as string);
      let success = false;

      if (isInMyList) {
        success = removeFromWishlist(mediaId);
      } else {
        success = addToWishlist(mediaId);
      }

      if (success) {
        setIsInMyList(!isInMyList);
        console.log(`${isInMyList ? 'Removed from' : 'Added to'} wishlist: ${media?.title}`);
      }
    } catch (error) {
      console.error('Error updating wishlist:', error);
    }
  };

  const loadPlaybackProgress = async () => {
    if (!params.id) return;

    try {
      // First try to load from backend API (same as ContinueWatching component)
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/playback/progress/${params.id}`, {
        headers: {
          'X-User-ID': '1' // Default user for now
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.position !== undefined && data.duration > 0) {
          setPlaybackProgress(data.position);
          setPlaybackDuration(data.duration);
          setHasWatchedBefore(true);
          setLastWatched(data.last_watched || new Date().toISOString());
          console.log(`Loaded playback progress from API: ${Math.round((data.position / data.duration) * 100)}%`);
          return;
        }
      }
    } catch (error) {
      console.log('Failed to load progress from API, trying local storage:', error);
    }

    // Fallback to cookie system
    const cookieProgress = getPlaybackProgressFromCookie(params.id as string);
    if (cookieProgress) {
      setPlaybackProgress(cookieProgress.currentTime);
      setPlaybackDuration(cookieProgress.duration);
      setHasWatchedBefore(true);
      setLastWatched(cookieProgress.lastWatched);
      console.log(`Loaded playback progress from cookie: ${Math.round(cookieProgress.percentage)}%`);
      return;
    }

    // Final fallback to localStorage (legacy system)
    const progress = localStorage.getItem(`progress_${params.id}`);
    if (progress) {
      try {
        const { progress: savedProgress, timestamp } = JSON.parse(progress);
        setPlaybackProgress(savedProgress);
        setLastWatched(timestamp);
        setHasWatchedBefore(savedProgress > 0);
        console.log('Loaded playback progress from localStorage (legacy)');
      } catch (error) {
        console.error('Error parsing localStorage progress:', error);
      }
    }
  };

  const handlePlay = () => {
    // Pause the background video when opening the player
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.muted = true;
      setIsVideoPlaying(false);
      console.log('Background video paused and muted for player');
    }
    setIsPlayerOpen(true);
  };

  const handlePlayFromBeginning = () => {
    // Clear progress and start from beginning
    if (params.id) {
      clearPlaybackProgress(params.id as string);
    }
    handlePlay();
  };

  const handlePlayerClose = () => {
    setIsPlayerOpen(false);

    // Resume the background video when closing the player
    if (videoRef.current && isVideoLoaded) {
      setTimeout(() => {
        const video = videoRef.current;
        if (video && !isPlayerOpen) {
          // Resume with sound when player closes
          video.muted = false;
          video.volume = 1.0;
          setIsMuted(false);
          video.play().then(() => {
            console.log('Background video resumed with sound after player close');
            setIsVideoPlaying(true);
          }).catch((error) => {
            console.log('Failed to resume background video with sound:', error);
            // Try muted fallback
            if (video) {
              video.muted = true;
              setIsMuted(true);
              video.play().catch(() => {
                console.log('Background video resume failed completely');
              });
            }
          });
        }
      }, 500); // Small delay to ensure player is fully closed
    }
  };

  // Handle cast button click
  const handleCastClick = () => {
    if (castState.isConnected) {
      disconnectFromCast();
    } else {
      connectToCast();
    }
  };

  // Start casting media when connected
  const handleStartCasting = () => {
    if (!media || !castState.isConnected) return;

    const streamUrl = `${getApiUrl()}/api/stream/${media.id}?quality=4k&format=mp4`;
    const thumbnailUrl = `${getApiUrl()}/api/thumbnails/${media.id}`;

    const castMedia: CastMedia = {
      contentId: streamUrl,
      contentType: 'video/mp4',
      title: media.title,
      subtitle: `${media.year || ''} • ${media.genres || ''}`,
      metadata: {
        title: media.title,
        subtitle: `${media.year || ''} • ${media.genres || ''}`,
        images: [{
          url: thumbnailUrl
        }]
      }
    };

    loadCastMedia(castMedia);
    console.log('Started casting:', media.title);
  };

  // Auto-start casting when connected and cast button is clicked
  React.useEffect(() => {
    if (castState.isConnected && media) {
      handleStartCasting();
    }
  }, [castState.isConnected, media]);

  const handlePlayerProgress = async (currentTime: number, duration: number) => {
    if (!params.id || !duration) return;

    try {
      // Save to backend API (same as ContinueWatching component expects)
      const apiUrl = getApiUrl();
      await fetch(`${apiUrl}/api/playback/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': '1' // Default user for now
        },
        body: JSON.stringify({
          media_id: parseInt(params.id as string),
          position: currentTime,
          duration: duration,
          progress: (currentTime / duration) * 100
        })
      });
      console.log(`Saved playback progress to API: ${Math.round((currentTime / duration) * 100)}%`);
    } catch (error) {
      console.log('Failed to save progress to API, using local storage:', error);
    }

    // Save to cookie-based system as fallback
    savePlaybackProgress(params.id as string, currentTime, duration);

    // Also save to localStorage for backward compatibility
    const progressData = {
      progress: currentTime,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(`progress_${params.id}`, JSON.stringify(progressData));
  };

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const formatProgressPercentage = (progress: number) => {
    return Math.round(progress * 100);
  };

  const getBackgroundImageUrl = (media: Media) => {
    const apiUrl = getApiUrl();
    if (media.banner_path) {
      return `${apiUrl}/api/admin/assets/${media.banner_path.split('/').pop()}`;
    }
    return `${apiUrl}/api/thumbnails/${media.id}`;
  };

  const getBackgroundVideoUrl = (media: Media) => {
    const apiUrl = getApiUrl();
    // First try trailer for background (lighter than full media file)
    if (media.trailer_path) {
      return `${apiUrl}/api/admin/assets/${media.trailer_path.split('/').pop()}`;
    }
    // Then try preview clips (optimized for background)
    if (media.preview_clip_path) {
      return `${apiUrl}/api/admin/assets/${media.preview_clip_path.split('/').pop()}`;
    }
    // Fallback to preview clips endpoint
    return `${apiUrl}/api/preview-clips/${media.id}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
      </div>
    );
  }

  if (!media) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-6">
        <h1 className="text-4xl font-bold text-white mb-4">Media Not Found</h1>
        <p className="text-xl text-white/80 mb-8">The requested media could not be found.</p>
        <button
          onClick={() => navigate.back()}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const renderMediaContent = (media: Media) => (
    <div className="min-h-screen bg-gradient-to-b from-red-900/20 via-black to-black text-white">
      <Navbar />
      <GradientBackground variant="cosmic" animate={true} className="fixed inset-0 -z-10" />

      {/* Hero Section */}
      <div className="relative h-screen overflow-hidden">
        {/* Background Image with Lazy Loading */}
        <div className="absolute inset-0" style={{ zIndex: 1 }}>
          <LazyImage
            src={getBackgroundImageUrl(media)}
            alt={media.title}
            fill
            className={`transition-opacity duration-1000 ${isVideoLoaded && isVideoPlaying ? 'opacity-0' : 'opacity-100'
              }`}
            priority
            sizes="100vw"
            loaderSize="large"
            showLoader={true}
          />
        </div>

        {/* Background Video - Load preview/trailer, not full media file */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover opacity-100"
          autoPlay={true}
          muted={false}
          loop={true}
          playsInline={true}
          preload="auto"
          controls={false}
          crossOrigin="anonymous"
          webkit-playsinline="true"
          x-webkit-airplay="allow"
          data-setup="{}"
          style={{
            zIndex: 5,
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          onLoadedData={() => {
            console.log('Media info preview video loaded successfully');
            setIsVideoLoaded(true);
            if (videoRef.current) {
              const video = videoRef.current;

              video.currentTime = 0;
              video.volume = 1.0;
              video.muted = false;

              // Immediate play attempt
              const immediatePlay = () => {
                video.play().then(() => {
                  console.log('Background video started playing with sound (onLoadedData)');
                  setIsVideoPlaying(true);
                  setIsMuted(false);
                }).catch((error) => {
                  console.log('onLoadedData play failed, trying muted:', error);
                  video.muted = true;
                  setIsMuted(true);
                  video.play().then(() => {
                    console.log('Background video started playing (muted fallback)');
                    setIsVideoPlaying(true);
                  }).catch(() => {
                    console.log('onLoadedData muted play also failed');
                  });
                });
              };

              // Try multiple times
              immediatePlay();
              setTimeout(immediatePlay, 50);
              setTimeout(immediatePlay, 200);
            }
          }}
          onError={(e) => {
            console.log('Preview video error occurred:', e);
            setIsVideoLoaded(false);
            setIsVideoPlaying(false);
          }}
          onCanPlay={() => {
            console.log('Preview video can play');
            const video = videoRef.current;
            if (video) {
              video.muted = false;
              video.volume = 1.0;

              const canPlayAttempt = () => {
                video.play().then(() => {
                  console.log('Video playing from onCanPlay with sound');
                  setIsVideoPlaying(true);
                  setIsMuted(false);
                }).catch(() => {
                  console.log('onCanPlay play with sound failed, trying muted');
                  video.muted = true;
                  setIsMuted(true);
                  video.play().then(() => {
                    console.log('Video playing from onCanPlay (muted)');
                    setIsVideoPlaying(true);
                  }).catch(() => {
                    console.log('onCanPlay play failed completely');
                  });
                });
              };

              canPlayAttempt();
              setTimeout(canPlayAttempt, 100);
            }
          }}
          onPlay={() => {
            console.log('Preview video started playing');
            setIsVideoPlaying(true);
            setIsMuted(false);
          }}
          onPause={() => {
            console.log('Preview video paused');
            setIsVideoPlaying(false);
          }}
          onLoadStart={() => {
            console.log('Preview video load started');
          }}
          onLoadedMetadata={() => {
            console.log('Preview video metadata loaded');
            const video = videoRef.current;
            if (video) {
              video.muted = false;
              video.volume = 1.0;

              const metadataPlay = () => {
                video.play().then(() => {
                  console.log('Video auto-started from metadata with sound');
                  setIsVideoPlaying(true);
                  setIsMuted(false);
                }).catch(() => {
                  console.log('Metadata play with sound failed, trying muted');
                  video.muted = true;
                  setIsMuted(true);
                  video.play().then(() => {
                    console.log('Video auto-started from metadata (muted)');
                    setIsVideoPlaying(true);
                  }).catch(() => {
                    console.log('Metadata play failed completely');
                  });
                });
              };

              metadataPlay();
              setTimeout(metadataPlay, 50);
            }
          }}
        >
          {/* Preview/trailer sources - not full media file */}
          <source src={`${getBackgroundVideoUrl(media)}?audio=aac&quality=medium`} type="video/mp4" />
          <source src={`${getBackgroundVideoUrl(media)}`} type="video/mp4" />
          <source src={getAssetUrl('preview', media.id, false) as string} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Static overlay background that stays in place */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/40 z-15"
          initial={{ opacity: 1 }}
          animate={{
            opacity: showTitleOverlay ? 1 : 0.3
          }}
          transition={{
            duration: 1.2,
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
        />

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-10" />

        {/* Navigation */}
        <div className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-center">

        </div>

        {/* Hero Content - Bottom Left */}
        <div className="absolute bottom-0 left-0 z-20 p-6 md:p-8 lg:p-12">
          <div
            className="flex flex-col justify-end"
            onMouseEnter={() => setIsHoveringTitle(true)}
            onMouseLeave={() => setIsHoveringTitle(false)}
          >
            <ParticleField count={30} className="absolute inset-0 opacity-20" />

            <div className="relative z-10 max-w-2xl">
              <div className="w-full">
                {/* Title that appears immediately */}
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{
                    opacity: 1,
                    y: 0
                  }}
                  transition={{
                    duration: 0.8,
                    delay: 0.2
                  }}
                  className="mb-6"
                >
                  <GenreTitle media={media} className="mb-4" />
                </motion.div>

                {/* Tagline with hover reveal */}
                {media.tagline && (
                  <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.8 }}
                    animate={{
                      opacity: (!showTitleOverlay || isHoveringTitle) ? 1 : 0,
                      y: (!showTitleOverlay || isHoveringTitle) ? 0 : 30,
                      scale: (!showTitleOverlay || isHoveringTitle) ? 1 : 0.8
                    }}
                    transition={{
                      duration: 0.6,
                      delay: 0.1,
                      ease: [0.25, 0.46, 0.45, 0.94]
                    }}
                  >
                    <p className="text-xl md:text-2xl text-white/90 italic mb-6 drop-shadow-lg">
                      &ldquo;{media.description && `${media.description.substring(0, 200)}` || "Watch and Enjoy Homeflix"}&rdquo;
                    </p>
                  </motion.div>
                )}

                {/* Metadata with hover reveal and scaling */}
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.8 }}
                  animate={{
                    opacity: (!showTitleOverlay || isHoveringTitle) ? 1 : 0,
                    y: (!showTitleOverlay || isHoveringTitle) ? 0 : 30,
                    scale: (!showTitleOverlay || isHoveringTitle) ? 1 : 0.8
                  }}
                  transition={{
                    duration: 0.6,
                    delay: 0.2,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }}
                  className="flex items-center gap-4 text-white/90 mb-6 flex-wrap"
                >
                  {media.rating && (
                    <span className="flex items-center gap-1 text-green-400 font-semibold">
                      <Star className="w-4 h-4" />
                      {media.rating.toFixed(1)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {media.year || (media.release_date && new Date(media.release_date).getFullYear()) || new Date().getFullYear()}
                  </span>
                  {media.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatRuntime(Math.floor(media.duration / 60))}
                    </span>
                  )}
                  {media.quality && (
                    <span className="px-2 py-1 bg-blue-600 text-white text-sm font-semibold rounded">
                      {media.quality.includes('2160') || media.quality.toLowerCase().includes('4k') ? '4K' : 'HD'}
                    </span>
                  )}
                </motion.div>

                {/* Action buttons with hover reveal and scaling */}
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.8 }}
                  animate={{
                    opacity: (!showTitleOverlay || isHoveringTitle) ? 1 : 0,
                    y: (!showTitleOverlay || isHoveringTitle) ? 0 : 30,
                    scale: (!showTitleOverlay || isHoveringTitle) ? 1 : 0.8
                  }}
                  transition={{
                    duration: 0.6,
                    delay: 0.3,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }}
                  className="flex flex-wrap gap-4 mb-8"
                >
                  {/* Play/Resume Button */}
                  <div className="relative">
                    <MagneticButton
                      onClick={handlePlay}
                      className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg text-lg font-semibold flex items-center gap-2 relative overflow-hidden"
                    >
                      <Play className="w-5 h-5" />
                      {hasWatchedBefore && playbackProgress > 0 ? 'Resume' : 'Play'}
                    </MagneticButton>

                    {/* Progress bar overlay on top */}
                    {hasWatchedBefore && playbackProgress > 0 && playbackDuration > 0 && (
                      <motion.div
                        className="absolute top-0 left-0 h-1 bg-red-400 rounded-t-lg"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min((playbackProgress / playbackDuration) * 100, 100)}%`
                        }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    )}
                  </div>

                  {/* Play from Beginning Button - Only show if has progress */}
                  {hasWatchedBefore && playbackProgress > 0 && (
                    <MagneticButton
                      onClick={handlePlayFromBeginning}
                      className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg text-lg font-semibold flex items-center gap-2 border border-white/20"
                    >
                      <Play className="w-5 h-5" />
                      Play from Beginning
                    </MagneticButton>
                  )}

                  <MagneticButton
                    onClick={toggleMyList}
                    className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full"
                  >
                    {isInMyList ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </MagneticButton>

                  <MagneticButton className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full">
                    <Share className="w-5 h-5" />
                  </MagneticButton>

                  {/* Cast Button */}
                  <CastButton
                    isAvailable={castState.isAvailable}
                    isConnected={castState.isConnected}
                    isConnecting={castState.isConnecting}
                    deviceName={castState.deviceName}
                    onClick={handleCastClick}
                    className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-all duration-200 hover:bg-blue-500/20 hover:border-blue-500/50"
                  />
                </motion.div>

                {/* Cast Status Indicator */}
                {castState.isConnected && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="flex items-center gap-3 mb-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg backdrop-blur-sm"
                  >
                    <Tv className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-blue-300 font-medium">
                        Casting to {castState.deviceName}
                      </p>
                      <p className="text-blue-400/80 text-sm">
                        {castState.playerState === 'PLAYING' ? 'Playing' :
                          castState.playerState === 'PAUSED' ? 'Paused' :
                            castState.playerState === 'BUFFERING' ? 'Buffering' : 'Ready'}
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Description with hover reveal and scaling */}
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.8 }}
                  animate={{
                    opacity: (!showTitleOverlay || isHoveringTitle) ? 1 : 0,
                    y: (!showTitleOverlay || isHoveringTitle) ? 0 : 30,
                    scale: (!showTitleOverlay || isHoveringTitle) ? 1 : 0.8
                  }}
                  transition={{
                    duration: 0.6,
                    delay: 0.4,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }}
                >
                  <p className="text-white/90 mb-2 text-lg leading-relaxed">
                    {media.description ? `${media.description}` : (
                      "Experience the ultimate entertainment with this amazing content. Watch now and immerse yourself in a world of endless possibilities."
                    )}
                    {/* {media.description && media.description.length > 200 && (
                      <button
                        onClick={() => setShowFullDescription(!showFullDescription)}
                        className="text-red-400 hover:text-red-300 ml-2 font-medium"
                      >
                        {showFullDescription ? 'Show less' : 'Read more'}
                      </button>
                    )} */}
                  </p>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details Section - Bottom Left */}
      <div className="relative z-10 bg-black pt-16 pb-24">
        <div className="container mx-auto px-6 md:px-12 lg:px-16">
          <div className="flex justify-start">
            <div className="w-full">
              {/* Media Info */}
              <div className="bg-gradient-to-r from-black/80 via-black/60 to-transparent p-8 rounded-2xl backdrop-blur-sm border border-white/10 shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-8">About {cleanMovieTitle(media.title)}</h2>
                {/* About Section with Poster Layout */}
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Left side - Text content */}
                  <div className="flex-1">
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 gap-8">
                        <div>
                          <div className="flex items-center gap-3 mb-6">
                            <Info className="w-6 h-6 text-red-500" />
                            <h3 className="text-xl font-semibold text-white">Details</h3>
                          </div>
                          <div className="space-y-4 pl-9">
                            {media.genres && media.genres.length > 0 && (
                              <div className="flex flex-col gap-3">
                                <span className="text-white/60 font-medium">Genres</span>
                                <div className="flex flex-wrap gap-2">
                                  {media.genres.map((genre, index) => (
                                    <span
                                      key={index}
                                      className="px-3 py-1.5 bg-gradient-to-r from-red-600/20 to-red-500/20 text-red-300 text-sm font-medium rounded-full border border-red-500/30 hover:from-red-600/30 hover:to-red-500/30 transition-all duration-200"
                                    >
                                      {genre.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {media.duration && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Duration</span>
                                <span className="text-white">{formatRuntime(Math.floor(media.duration / 60))}</span>
                              </div>
                            )}
                            {media.director && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Director</span>
                                <span className="text-white">{Array.isArray(media.director) ? media.director.join(', ') : media.director}</span>
                              </div>
                            )}
                            {media.stars && media.stars.length > 0 && (
                              <div className="flex flex-col gap-3">
                                <span className="text-white/60 font-medium">Cast</span>
                                <div className="flex flex-wrap gap-2">
                                  {media.stars.slice(0, 6).map((star: string, index: number) => (
                                    <span
                                      key={index}
                                      className="px-3 py-1.5 bg-gradient-to-r from-blue-600/20 to-blue-500/20 text-blue-300 text-sm font-medium rounded-full border border-blue-500/30 hover:from-blue-600/30 hover:to-blue-500/30 transition-all duration-200"
                                    >
                                      {star.trim()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {media.year && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Release</span>
                                <span className="text-white">{media.year}</span>
                              </div>
                            )}
                            {media.country && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Country</span>
                                <span className="text-white">{media.country}</span>
                              </div>
                            )}
                            {media.language && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Language</span>
                                <span className="text-white">{media.language}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Box Office & Financial Information */}
                      {(media.box_office || media.budget || media.revenue) && (
                        <div className="mt-8">
                          <div className="flex items-center gap-2 mb-4">
                            <Award className="w-5 h-5 text-green-500" />
                            <h3 className="text-lg font-semibold text-white">Box Office & Financial</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {media.box_office && (
                              <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 p-4 rounded-lg border border-green-500/20">
                                <div className="text-green-400 text-sm font-medium mb-1">Box Office</div>
                                <div className="text-white text-xl font-bold">{media.box_office}</div>
                              </div>
                            )}
                            {media.budget && media.budget > 0 && (
                              <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 p-4 rounded-lg border border-blue-500/20">
                                <div className="text-blue-400 text-sm font-medium mb-1">Budget</div>
                                <div className="text-white text-xl font-bold">
                                  {media.budget >= 1000000000
                                    ? `$${(media.budget / 1000000000).toFixed(1)}B`
                                    : media.budget >= 1000000
                                      ? `$${(media.budget / 1000000).toFixed(1)}M`
                                      : `$${media.budget.toLocaleString()}`
                                  }
                                </div>
                              </div>
                            )}
                            {media.revenue && media.revenue > 0 && (
                              <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 p-4 rounded-lg border border-purple-500/20">
                                <div className="text-purple-400 text-sm font-medium mb-1">Revenue</div>
                                <div className="text-white text-xl font-bold">
                                  {media.revenue >= 1000000000
                                    ? `$${(media.revenue / 1000000000).toFixed(1)}B`
                                    : media.revenue >= 1000000
                                      ? `$${(media.revenue / 1000000).toFixed(1)}M`
                                      : `$${media.revenue.toLocaleString()}`
                                  }
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Additional Metadata */}
                      {(media.imdb_id || media.homepage || media.collection) && (
                        <div className="mt-8">
                          <div className="flex items-center gap-2 mb-4">
                            <Film className="w-5 h-5 text-red-500" />
                            <h3 className="text-lg font-semibold text-white">Additional Information</h3>
                          </div>
                          <div className="space-y-2">
                            {media.imdb_id && (
                              <div className="flex">
                                <span className="w-32 text-white/60">IMDB ID</span>
                                <a
                                  href={`https://www.imdb.com/title/${media.imdb_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-yellow-400 hover:text-yellow-300 underline"
                                >
                                  {media.imdb_id}
                                </a>
                              </div>
                            )}
                            {media.homepage && (
                              <div className="flex">
                                <span className="w-32 text-white/60">Official Site</span>
                                <a
                                  href={media.homepage}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 underline"
                                >
                                  Visit Website
                                </a>
                              </div>
                            )}
                            {media.collection && (
                              <div className="flex">
                                <span className="w-32 text-white/60">Collection</span>
                                <span className="text-white">{media.collection}</span>
                              </div>
                            )}
                            {media.runtime && (
                              <div className="flex">
                                <span className="w-32 text-white/60">Runtime</span>
                                <span className="text-white">{formatRuntime(media.runtime)}</span>
                              </div>
                            )}
                            {media.vote_count && (
                              <div className="flex">
                                <span className="w-32 text-white/60">Votes</span>
                                <span className="text-white">{media.vote_count.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Additional Stats Section */}
                      <div className="mt-8">
                        <h3 className="text-lg font-semibold text-white mb-3">Statistics</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {media.rating && (
                            <div className="bg-gray-800/50 p-4 rounded-lg text-center">
                              <div className="flex items-center justify-center gap-1 text-yellow-400 mb-1">
                                <Star className="w-4 h-4" />
                                <span className="text-xl font-bold">{media.rating.toFixed(1)}</span>
                              </div>
                              <span className="text-white/60 text-sm">Rating</span>
                            </div>
                          )}
                          <div className="bg-gray-800/50 p-4 rounded-lg text-center">
                            <div className="text-xl font-bold text-white mb-1">
                              {(media.view_count || 0).toLocaleString()}
                            </div>
                            <span className="text-white/60 text-sm">Views</span>
                          </div>
                          <div className="bg-gray-800/50 p-4 rounded-lg text-center">
                            <div className="text-xl font-bold text-white mb-1">
                              {media.year}
                            </div>
                            <span className="text-white/60 text-sm">Year</span>
                          </div>
                          {media.genres && media.genres.length > 0 && (
                            <div className="bg-gray-800/50 p-4 rounded-lg text-center">
                              <div className="text-xl font-bold text-white mb-1">
                                {media.genres.length}
                              </div>
                              <span className="text-white/60 text-sm">Genres</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar */}
                  <div className="hidden lg:block space-y-6 ml-6">
                    {/* Cast & Crew Section */}
                    {(media.stars && media.stars.length > 0) || (media.director && media.director.length > 0) ? (
                      <div className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-6">Cast & Crew</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                          {/* Director Section */}
                          {media.director && media.director.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <Director className="w-5 h-5 text-red-500" />
                                <h3 className="text-lg font-semibold text-white">
                                  Director{media.director.length > 1 ? 's' : ''}
                                </h3>
                              </div>
                              <div className="space-y-3">
                                {media.director.map((director, index) => (
                                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors">
                                    <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                                      <Director className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <div>
                                      <p className="text-white font-medium">{director}</p>
                                      <p className="text-white/60 text-sm">Director</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Cast Section */}
                          {media.stars && media.stars.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <Cast className="w-5 h-5 text-red-500" />
                                <h3 className="text-lg font-semibold text-white">Cast</h3>
                              </div>
                              <div className="space-y-3">
                                {media.stars.slice(0, 6).map((actor, index) => (
                                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors">
                                    <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                                      <User className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <div>
                                      <p className="text-white font-medium">{actor}</p>
                                      <p className="text-white/60 text-sm">Actor</p>
                                    </div>
                                  </div>
                                ))}
                                {media.stars.length > 6 && (
                                  <div className="text-center">
                                    <button
                                      onClick={() => setShowMoreInfo(!showMoreInfo)}
                                      className="text-red-400 hover:text-red-300 text-sm font-medium flex items-center gap-1 mx-auto"
                                    >
                                      {showMoreInfo ? (
                                        <>
                                          Show Less <ChevronUp className="w-4 h-4" />
                                        </>
                                      ) : (
                                        <>
                                          Show {media.stars.length - 6} More <ChevronDown className="w-4 h-4" />
                                        </>
                                      )}
                                    </button>
                                    {showMoreInfo && (
                                      <div className="mt-3 space-y-3">
                                        {media.stars.slice(6).map((actor, index) => (
                                          <div key={index + 6} className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors">
                                            <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                                              <User className="w-6 h-6 text-gray-400" />
                                            </div>
                                            <div>
                                              <p className="text-white font-medium">{actor}</p>
                                              <p className="text-white/60 text-sm">Actor</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Right side - Movie Poster */}
                  <div className="lg:w-64 flex-shrink-0">
                    <div className="sticky top-8">
                      <div className="relative w-full h-80 lg:h-96 rounded-xl overflow-hidden shadow-2xl border border-white/10">
                        <ImageWithFallback
                          mediaId={media.id}
                          alt={cleanMovieTitle(media.title)}
                          fill={true}
                          sizes="(max-width: 1024px) 100vw, 256px"
                          className="object-cover transition-transform duration-300 hover:scale-105"
                          loading="eager"
                        />

                        {/* Overlay with movie info */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            <h3 className="text-white font-bold text-sm mb-1">{cleanMovieTitle(media.title)}</h3>
                            {media.year && (
                              <p className="text-white/80 text-xs mb-1">{media.year}</p>
                            )}
                            {media.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                <span className="text-white text-xs font-medium">{media.rating.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {/* Enhanced Recommendations Section */}
      <div className="py-8 bg-black">
        <div className="container mx-auto px-6 md:px-12 lg:px-16">
          <RecommendationSection
            currentMedia={media}
            onPlay={(m: Media) => {
              setMedia(m);
              setIsPlayerOpen(true);
            }}
            onInfo={(m: Media) => navigate.push(`/movie/${m.id}`)}
          />
        </div>
      </div>

      {/* Video Player Modal */}
      {media && (
        <VideoPlayer
          media={media}
          isOpen={isPlayerOpen}
          onClose={handlePlayerClose}
          startTime={hasWatchedBefore && playbackProgress > 0 ? playbackProgress : 0}
          onPlayNext={(nextMedia) => {
            console.log('Playing next episode:', nextMedia.title);
            // For movies, this would typically not be used, but we'll handle it gracefully
            window.location.href = `/movie/${nextMedia.id}`;
          }}
        />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-black">
      {media ? (
        renderMediaContent(media)
      ) : (
        <div className="flex items-center justify-center h-screen">
        </div>
      )}
    </div>
  );
}
