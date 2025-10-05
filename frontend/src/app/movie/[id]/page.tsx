"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Play, Plus, Check, Share, Download, Info, Star, Clock, Calendar, Globe, Users, Award, Film, Tv, User, Mic, ChevronDown, ChevronUp, Volume2, VolumeX, Users as Cast, User as Director } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from 'next/image';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
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

export default function MoviePage() {
  const params = useParams();
  const router = useRouter();
  const [media, setMedia] = useState<Media | null>(null);
  const [similarMedia, setSimilarMedia] = useState<Media[]>([]);
  const [allMedia, setAllMedia] = useState<Media[]>([]);
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
  const [isMuted, setIsMuted] = useState(false); // Always start with ALAC audio enabled
  const [showTitleOverlay, setShowTitleOverlay] = useState(true); // Netflix-style title overlay
  const [isHoveringTitle, setIsHoveringTitle] = useState(false); // Hover state for title area
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (params.id) {
      fetchMedia();
      fetchSimilarMedia();
      checkMyList();
      loadPlaybackProgress();
    }
  }, [params.id]);

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

  const fetchSimilarMedia = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/media`);
      if (response.ok) {
        const data = await response.json();
        setAllMedia(data);

        if (media) {
          // Use smart similarity matching
          const similar = findSimilarMovies(media.title, data, 8);
          setSimilarMedia(similar);
        } else {
          // Fallback to random selection
          const filtered = data.filter((item: Media) => item.id !== parseInt(params.id as string));
          const shuffled = filtered.sort(() => 0.5 - Math.random());
          setSimilarMedia(shuffled.slice(0, 6));
        }
      }
    } catch (error) {
      console.error('Error fetching similar media:', error);
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

  const loadPlaybackProgress = () => {
    if (!params.id) return;

    // Try to load from cookie first (new system)
    const cookieProgress = getPlaybackProgressFromCookie(params.id as string);
    if (cookieProgress) {
      setPlaybackProgress(cookieProgress.currentTime);
      setPlaybackDuration(cookieProgress.duration);
      setHasWatchedBefore(true);
      setLastWatched(cookieProgress.lastWatched);
      console.log(`Loaded playback progress from cookie: ${Math.round(cookieProgress.percentage)}%`);
      return;
    }

    // Fallback to localStorage (legacy system)
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
    if (videoRef.current && isVideoPlaying) {
      videoRef.current.pause();
      console.log('Background video paused for player');
    }
    setIsPlayerOpen(true);
  };

  const handlePlayerClose = () => {
    // Resume the background video when closing the player
    if (videoRef.current && isVideoLoaded) {
      videoRef.current.play().then(() => {
        console.log('Background video resumed after player close');
        setIsVideoPlaying(true);
      }).catch((error) => {
        console.log('Failed to resume background video:', error);
      });
    }
    setIsPlayerOpen(false);
  };

  const handlePlayerProgress = (currentTime: number, duration: number) => {
    if (!params.id || !duration) return;

    // Save to cookie-based system
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
    if (media.poster_path) {
      return `${apiUrl}/api/posters/${media.id}`;
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
      <GradientBackground variant="cosmic" animate={true}>
        <div className="min-h-screen flex items-center justify-center">
          <FloatingElement>
            <RedLoader size="large" showText text="Loading movie details..." />
          </FloatingElement>
        </div>
      </GradientBackground>
    );
  }

  if (!media) {
    return (
      <GradientBackground variant="cosmic" animate={true}>
        <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
          <h1 className="text-4xl font-bold text-white mb-4">Media Not Found</h1>
          <p className="text-xl text-white/80 mb-8">The requested media could not be found.</p>
          <MagneticButton
            onClick={() => router.back()}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg"
          >
            Go Back
          </MagneticButton>
        </div>
      </GradientBackground>
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
          autoPlay
          muted={false}
          loop
          playsInline
          preload="metadata"
          controls={false}
          crossOrigin="anonymous"
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
              video.volume = 0.6; // Lower volume for background preview
              video.muted = false;

              // Enhanced playback with fallbacks
              const attemptPlay = async () => {
                try {
                  await video.play();
                  console.log('Media info preview video playing successfully');
                  setIsVideoPlaying(true);
                } catch (error) {
                  console.log('Autoplay failed, trying muted fallback:', error);
                  try {
                    video.muted = true;
                    await video.play();
                    setIsVideoPlaying(true);

                    // Add click listener to unmute
                    const handleClick = () => {
                      video.muted = false;
                      video.volume = 0.6;
                      document.removeEventListener('click', handleClick);
                    };
                    document.addEventListener('click', handleClick);
                  } catch (mutedError) {
                    console.log('Video playback failed completely:', mutedError);
                    setIsVideoLoaded(false);
                    setIsVideoPlaying(false);
                  }
                }
              };

              attemptPlay();
            }
          }}
          onError={(e) => {
            console.log('Preview video error occurred:', e);
            setIsVideoLoaded(false);
            setIsVideoPlaying(false);
          }}
          onCanPlay={() => {
            console.log('Preview video can play');
            if (videoRef.current && !isVideoPlaying) {
              const video = videoRef.current;
              video.play().catch(() => {
                console.log('CanPlay auto-play failed');
              });
            }
          }}
          onPlay={() => {
            console.log('Preview video started playing');
            setIsVideoPlaying(true);
          }}
          onPause={() => {
            console.log('Preview video paused');
          }}
          onLoadStart={() => {
            console.log('Preview video load started');
          }}
          onLoadedMetadata={() => {
            console.log('Preview video metadata loaded');
          }}
        >
          {/* Preview/trailer sources - not full media file */}
          <source src={`${getBackgroundVideoUrl(media)}?audio=aac&quality=medium`} type="video/mp4" />
          <source src={`${getBackgroundVideoUrl(media)}`} type="video/mp4" />
          <source src={`${getApiUrl()}/api/preview-clips/${media.id}`} type="video/mp4" />
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

        {/* Hero Content */}
        <div className="absolute inset-0 flex items-end z-20">
          <div
            className="w-full h-full flex items-end"
            onMouseEnter={() => setIsHoveringTitle(true)}
            onMouseLeave={() => setIsHoveringTitle(false)}
          >
            <ParticleField count={50} className="absolute inset-0 opacity-30" />

            <div className="container mx-auto px-6 md:px-12 lg:px-16 relative z-10">
              <div className="max-w-4xl w-full">
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

                  {/* Year below title */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="text-white/80 text-lg font-medium"
                  >
                    {media.year || (media.release_date && new Date(media.release_date).getFullYear()) || new Date().getFullYear()}
                  </motion.div>
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
                      &ldquo;{media.tagline}&rdquo;
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
                      {media.rating}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date().getFullYear()}
                  </span>
                  {media.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatRuntime(Math.floor(media.duration / 60))}
                    </span>
                  )}
                  <span className="text-green-400 font-medium">
                    {(media.view_count || 0).toLocaleString()} views
                  </span>
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
                  <div className="relative">
                    <MagneticButton
                      onClick={handlePlay}
                      className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg text-lg font-semibold flex items-center gap-2 relative overflow-hidden"
                    >
                      <Play className="w-5 h-5" />
                      {hasWatchedBefore && playbackProgress > 0 ? 'Continue Playing' : 'Play'}
                      {hasWatchedBefore && playbackProgress > 0 && playbackDuration > 0 && (
                        <span className="text-sm font-normal opacity-80">
                          {Math.round((playbackProgress / playbackDuration) * 100)}%
                        </span>
                      )}
                    </MagneticButton>
                    
                    {/* Progress bar overlay */}
                    {hasWatchedBefore && playbackProgress > 0 && playbackDuration > 0 && (
                      <motion.div
                        className="absolute bottom-0 left-0 h-1 bg-red-400 rounded-b-lg"
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${Math.min((playbackProgress / playbackDuration) * 100, 100)}%` 
                        }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    )}
                  </div>

                  <MagneticButton
                    onClick={toggleMyList}
                    className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full"
                  >
                    {isInMyList ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </MagneticButton>

                  <MagneticButton className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full">
                    <Share className="w-5 h-5" />
                  </MagneticButton>

                  <MagneticButton className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full">
                    <Download className="w-5 h-5" />
                  </MagneticButton>
                </motion.div>

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
                  <p className="text-white/90 mb-4 text-lg leading-relaxed">
                    {media.long_desc ? (
                      showFullDescription ? media.long_desc : `${media.long_desc.substring(0, 200)}...`
                    ) : (
                      "Experience the ultimate entertainment with this amazing content. Watch now and immerse yourself in a world of endless possibilities."
                    )}
                    {media.long_desc && media.long_desc.length > 200 && (
                      <button
                        onClick={() => setShowFullDescription(!showFullDescription)}
                        className="text-red-400 hover:text-red-300 ml-2 font-medium"
                      >
                        {showFullDescription ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </p>
                </motion.div>
              </div>
            </div>
          </div>
        </div>


      </div>

      {/* Details Section */}
      <div className="relative z-10 bg-black pt-16 pb-24">
        <div className="container mx-auto px-6 md:px-12 lg:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              {/* Media Info */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-6">About {cleanMovieTitle(media.title)}</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Info className="w-5 h-5 text-red-500" />
                        <h3 className="text-lg font-semibold text-white">Details</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex">
                          <span className="w-32 text-white/60">Type</span>
                          <span className="text-white capitalize">{media.type}</span>
                        </div>
                        {media.genres && media.genres.length > 0 && (
                          <div className="flex">
                            <span className="w-32 text-white/60">Genres</span>
                            <span className="text-white">
                              {media.genres.map((g) => g.name).join(', ')}
                            </span>
                          </div>
                        )}
                        {media.duration && (
                          <div className="flex">
                            <span className="w-32 text-white/60">Duration</span>
                            <span className="text-white">{formatRuntime(Math.floor(media.duration / 60))}</span>
                          </div>
                        )}
                        {media.director && (
                          <div className="flex">
                            <span className="w-32 text-white/60">Director</span>
                            <span className="text-white">{media.director}</span>
                          </div>
                        )}
                        {media.stars && (
                          <div className="flex">
                            <span className="w-32 text-white/60">Cast</span>
                            <span className="text-white">{media.stars}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Production</h3>
                      <div className="space-y-2">
                        {media.director && (
                          <div className="flex">
                            <span className="w-32 text-white/60">Director</span>
                            <span className="text-white">{media.director}</span>
                          </div>
                        )}
                        {media.description && (
                          <div className="flex">
                            <span className="w-32 text-white/60">Studio</span>
                            <span className="text-white">HomeFlix Studios</span>
                          </div>
                        )}
                        {media.release_date && (
                          <div className="flex">
                            <span className="w-32 text-white/60">Release Date</span>
                            <span className="text-white">{formatDate(media.release_date)}</span>
                          </div>
                        )}
                        {media.country && (
                          <div className="flex">
                            <span className="w-32 text-white/60">Country</span>
                            <span className="text-white">{media.country}</span>
                          </div>
                        )}
                        {media.language && (
                          <div className="flex">
                            <span className="w-32 text-white/60">Language</span>
                            <span className="text-white">{media.language}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Additional Stats Section */}
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-white mb-3">Statistics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {media.rating && (
                        <div className="bg-gray-800/50 p-4 rounded-lg text-center">
                          <div className="flex items-center justify-center gap-1 text-yellow-400 mb-1">
                            <Star className="w-4 h-4" />
                            <span className="text-xl font-bold">{media.rating}</span>
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
                          {new Date().getFullYear()}
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

            {/* Sidebar */}
            <div className="space-y-6">
              {media.genres && media.genres.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Genres</h3>
                  <div className="flex flex-wrap gap-2">
                    {media.genres.map((genre) => (
                      <span
                        key={genre.id}
                        className="px-3 py-1 bg-white/10 text-white/90 rounded-full text-sm"
                      >
                        {genre.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {similarMedia.length > 0 && (
        <div className="py-16 bg-black">
          <div className="container mx-auto px-6 md:px-12 lg:px-16">
            <h2 className="text-2xl font-bold text-white mb-8">More Like This</h2>
            <NetflixHorizontalRow
              title=""
              media={similarMedia.map(item => ({
                ...item,
                title: cleanMovieTitle(item.title)
              }))}
              onPlay={(m: Media) => {
                setMedia(m);
                setIsPlayerOpen(true);
              }}
              onInfo={(m: Media) => router.push(`/movie/${m.id}`)}
              variant="portrait"
              size="medium"
            />
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {media && (
        <VideoPlayer
          media={media}
          isOpen={isPlayerOpen}
          onClose={handlePlayerClose}
          startTime={0}
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
          <p className="text-white">Loading...</p>
        </div>
      )}
    </div>
  );
}
