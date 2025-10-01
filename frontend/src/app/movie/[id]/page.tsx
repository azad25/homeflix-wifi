"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Play, Plus, Check, Share, Download, Info, Star, Clock, Calendar, Globe, Users, Award, Film, Tv, User, Mic, ChevronDown, ChevronUp, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from 'next/image';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { updatePlaybackProgress, getPlaybackProgress } from '@/lib/playback';
import Navbar from '@/components/Navbar';
import { cleanMovieTitle } from '@/lib/titleUtils';
import VideoPlayer from '@/components/VideoPlayer';
import GenreTitle from '@/components/GenreTitle';
import QualityBadge from '../../../components/QualityBadge';
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
  const [similarMedia] = useState<Media[]>([]);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isInMyList, setIsInMyList] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [lastWatched, setLastWatched] = useState<string | null>(null);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<{browser: string, version: string, mobile: boolean}>({browser: '', version: '', mobile: false});
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false); // Always start with ALAC audio enabled
  const [showTitleOverlay, setShowTitleOverlay] = useState(true); // Netflix-style title overlay
  const [isHoveringTitle, setIsHoveringTitle] = useState(false); // Hover state for title area
  const videoRef = useRef<HTMLVideoElement>(null);

  // Browser detection for video compatibility
  useEffect(() => {
    const detectBrowser = () => {
      const ua = navigator.userAgent;
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      
      let browser = 'unknown';
      let version = '0';
      
      if (ua.includes('Chrome') && !ua.includes('Edg')) {
        browser = 'chrome';
        version = ua.match(/Chrome\/(\d+)/)?.[1] || '0';
      } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        browser = 'safari';
        version = ua.match(/Version\/(\d+)/)?.[1] || '0';
      } else if (ua.includes('Firefox')) {
        browser = 'firefox';
        version = ua.match(/Firefox\/(\d+)/)?.[1] || '0';
      } else if (ua.includes('Edg')) {
        browser = 'edge';
        version = ua.match(/Edg\/(\d+)/)?.[1] || '0';
      }
      
      setBrowserInfo({ browser, version, mobile });
      console.log('Movie page - Detected browser:', { browser, version, mobile });
    };
    
    detectBrowser();
  }, []);

  useEffect(() => {
    if (params.id) {
      fetchMedia();
      checkMyList();
      loadPlaybackProgress();
    }
  }, [params.id]);

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

  // Similar media is now handled by the RecommendationSection component

  const checkMyList = async () => {
    // Implementation for checking if media is in user's list
    // This would typically call your API
    setIsInMyList(false); // Placeholder
  };

  const toggleMyList = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/user/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaId: params.id,
          action: isInMyList ? 'remove' : 'add',
        }),
      });
      
      if (response.ok) {
        setIsInMyList(!isInMyList);
      }
    } catch (error) {
      console.error('Error updating list:', error);
    }
  };

  const loadPlaybackProgress = () => {
    if (!params.id) return;
    
    const progress = localStorage.getItem(`progress_${params.id}`);
    if (progress) {
      const { progress: savedProgress, timestamp } = JSON.parse(progress);
      setPlaybackProgress(savedProgress);
      setLastWatched(timestamp);
    }
  };

  const handlePlay = () => {
    setIsPlayerOpen(true);
  };

  const handlePlayerClose = () => {
    setIsPlayerOpen(false);
  };

  const handlePlayerProgress = (progress: number) => {
    if (!params.id) return;
    
    const progressData = {
      progress,
      timestamp: new Date().toISOString(),
    };
    
    localStorage.setItem(`progress_${params.id}`, JSON.stringify(progressData));
    setPlaybackProgress(progress);
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
    
    // Try multiple video sources in order of preference
    const sources = [
      // Primary streaming endpoint
      `${apiUrl}/api/stream/${media.id}`,
      // Trailer if available
      media.trailer_path ? `${apiUrl}/api/admin/assets/${media.trailer_path.split('/').pop()}` : null,
      // Preview clips
      `${apiUrl}/api/preview-clips/${media.id}`,
      // Thumbnail video if available
      `${apiUrl}/api/thumbnails/${media.id}?format=video`,
      // Direct file path if available
      media.file_path ? `${apiUrl}/api/media/${media.file_path.split('/').pop()}` : null
    ].filter(Boolean);
    
    // Return the first available source
    return sources[0] || `${apiUrl}/api/stream/${media.id}`;
  };

  if (loading) {
    return (
      <GradientBackground variant="cosmic" animate={true}>
        <div className="min-h-screen flex items-center justify-center">
          <FloatingElement>
            <div className="text-white text-xl">Loading...</div>
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


  if (loading) {
    return (
      <GradientBackground variant="cosmic" animate={true}>
        <div className="min-h-screen flex items-center justify-center">
          <FloatingElement>
            <div className="text-white text-xl">Loading...</div>
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-900/20 via-black to-black text-white">
      <Navbar />
      <GradientBackground variant="cosmic" animate={true} className="fixed inset-0 -z-10" />
    
    {/* Hero Section */}
    <div className="relative h-screen overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0" style={{ zIndex: 1 }}>
        <Image
          src={getBackgroundImageUrl(media)}
          alt={media.title}
          fill
          className={`object-cover transition-opacity duration-1000 ${
            isVideoLoaded && isVideoPlaying ? 'opacity-0' : 'opacity-100'
          }`}
          priority
          style={{ zIndex: 1 }}
          sizes="100vw"
        />
      </div>
      
      {/* Netflix-style Background Video */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay={browserInfo.browser !== 'chrome'}
        muted={browserInfo.browser === 'chrome' || browserInfo.browser === 'firefox'}
        loop={false}
        playsInline
        preload="auto"
        webkit-playsinline="true"
        x5-playsinline="true"
        crossOrigin="anonymous"
        onCanPlay={(e) => {
          const video = e.currentTarget;
          
          // Enhanced video loading with ALAC support
          const alacSupport = video.canPlayType('video/mp4; codecs="avc1.42E01E, alac"');
          console.log('Movie page ALAC codec support:', alacSupport);
          
          video.currentTime = 0;
          video.volume = 1.0; // Maximum volume for full sound experience
          
          // Browser-specific video playback strategies for movie page - ALWAYS FULL SOUND
          const attemptPlayback = async () => {
              // Force immediate setup with full sound
              video.currentTime = 0;
              video.volume = 1.0; // Always maximum volume
              
              // Check video codec support
              const codecSupport = {
                mp4: video.canPlayType('video/mp4'),
                webm: video.canPlayType('video/webm'),
                h264: video.canPlayType('video/mp4; codecs="avc1.42E01E"'),
                vp9: video.canPlayType('video/webm; codecs="vp9"'),
                alac: video.canPlayType('video/mp4; codecs="avc1.42E01E, alac"')
              };
              
              console.log('Movie page - Video codec support:', codecSupport);
              console.log('Movie page - Browser info:', browserInfo);
              
              // Define browser-specific strategies
              const strategies = [];
              
              // Strategy for Safari (best ALAC support) - FULL SOUND
              if (browserInfo.browser === 'safari') {
                strategies.push(
                  async () => {
                    video.muted = false;
                    video.volume = 1.0; // Maximum volume for full sound
                    video.setAttribute('autoplay', 'true');
                    video.setAttribute('playsinline', 'true');
                    await video.play();
                    console.log('Movie Safari: Video playing with full sound');
                    return true;
                  }
                );
              }
              
              // Strategy for Chrome/Chromium - ENHANCED FOR FULL SOUND
              if (browserInfo.browser === 'chrome') {
                strategies.push(
                  // Strategy 1: Try direct unmuted play first
                  async () => {
                    video.muted = false;
                    video.volume = 1.0;
                    video.setAttribute('autoplay', 'true');
                    video.setAttribute('playsinline', 'true');
                    await video.play();
                    console.log('Movie Chrome: Direct full sound playback successful');
                    return true;
                  },
                  // Strategy 2: Muted start with immediate unmute
                  async () => {
                    // Start muted for Chrome autoplay policy
                    video.muted = true;
                    video.setAttribute('muted', 'true');
                    video.setAttribute('autoplay', 'true');
                    video.setAttribute('playsinline', 'true');
                    
                    // Ensure video is ready
                    if (video.readyState < 2) {
                      await new Promise(resolve => {
                        video.addEventListener('loadeddata', resolve, { once: true });
                        video.load();
                      });
                    }
                    
                    await video.play();
                    console.log('Movie Chrome: Video playing (muted)');
                    
                    // Add comprehensive interaction handlers
                    const unlockAudio = () => {
                      video.muted = false;
                      video.volume = 0.8;
                      console.log('Movie Chrome: Audio unlocked');
                    };
                    
                    ['click', 'touchstart', 'keydown', 'scroll', 'mousemove'].forEach(event => {
                      document.addEventListener(event, unlockAudio, { once: true });
                    });
                    
                    return true;
                  }
                );
              }
              
              // Strategy for Firefox
              if (browserInfo.browser === 'firefox') {
                strategies.push(
                  async () => {
                    video.muted = true;
                    video.setAttribute('autoplay', 'true');
                    await video.play();
                    console.log('Movie Firefox: Video playing (muted)');
                    
                    const unlockAudio = () => {
                      video.muted = false;
                      video.volume = 0.8;
                    };
                    document.addEventListener('click', unlockAudio, { once: true });
                    return true;
                  }
                );
              }
              
              // Universal fallback strategies
              strategies.push(
                // Universal muted autoplay
                async () => {
                  video.muted = true;
                  video.setAttribute('muted', 'true');
                  video.setAttribute('autoplay', 'true');
                  video.setAttribute('playsinline', 'true');
                  
                  await video.play();
                  console.log('Movie Universal: Muted autoplay successful');
                  
                  // Universal interaction unlock
                  const unlockAudio = () => {
                    video.muted = false;
                    video.volume = 0.8;
                    console.log('Movie Universal: Audio unlocked');
                  };
                  
                  ['click', 'touchstart', 'keydown'].forEach(event => {
                    document.addEventListener(event, unlockAudio, { once: true });
                  });
                  
                  return true;
                },
                // Force load and play
                async () => {
                  video.load();
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  video.muted = true;
                  video.currentTime = 0;
                  
                  await video.play();
                  console.log('Movie Force load: Video playing');
                  return true;
                },
                // Last resort: manual trigger
                async () => {
                  console.log('Movie Manual trigger required for video playback');
                  video.muted = true;
                  
                  const playButton = document.createElement('button');
                  playButton.textContent = '▶ Play Movie Video';
                  playButton.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 9999;
                    padding: 12px 24px;
                    background: rgba(229, 9, 20, 0.9);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                  `;
                  
                  playButton.onclick = async () => {
                    try {
                      await video.play();
                      video.muted = false;
                      video.volume = 0.8;
                      document.body.removeChild(playButton);
                      console.log('Movie Manual: Video playing with audio');
                    } catch (e) {
                      console.error('Movie Manual play failed:', e);
                    }
                  };
                  
                  document.body.appendChild(playButton);
                  return true;
                }
              );
              
              // Execute strategies in order
              for (const strategy of strategies) {
                try {
                  await strategy();
                  setIsVideoPlaying(true);
                  return; // Success, exit
                } catch (error) {
                  if ((error as any).name === 'AbortError') {
                    console.log('Movie play request was aborted, ignoring error');
                    return;
                  }
                  console.warn('Movie strategy failed, trying next:', error);
                  continue;
                }
              }
              
              // All strategies failed
              console.error('All movie video playback strategies failed for:', media.title);
            };
            
            // Browser-specific delay
            const delay = browserInfo.browser === 'chrome' ? 300 : 
                         browserInfo.browser === 'firefox' ? 200 : 100;
            setTimeout(attemptPlayback, delay);
          }} 
          onEnded={(e) => {
            const video = e.currentTarget;
            console.log('Movie background video ended:', media.title);
            // Don't restart - let it stay on the last frame
            video.currentTime = video.duration - 0.1;
          }}
          onError={(e) => {
            const target = e.target as HTMLVideoElement;
            console.warn('Media info video error:', media.title, {
              error: target.error,
              networkState: target.networkState,
              readyState: target.readyState,
              currentSrc: target.currentSrc
            });
            
            // Try next source or fallback
            if (target.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
              console.log('No valid video source found for media info:', media.title);
              setIsVideoLoaded(false);
              setIsVideoPlaying(false);
            }
          }}
        >
          {/* ALAC format sources with high-quality audio */}
          <source src={`${getBackgroundVideoUrl(media)}?audio_codec=alac&audio_quality=lossless`} type='video/mp4; codecs="avc1.42E01E, alac"' />
          <source src={`${getBackgroundVideoUrl(media)}?audio_codec=alac&audio_quality=lossless`} type='video/mp4; codecs="avc1.640028, alac"' />
          <source src={`${getBackgroundVideoUrl(media)}?format=mov&audio_codec=alac`} type='video/quicktime; codecs="avc1.42E01E, alac"' />
          {/* Multiple format sources for maximum compatibility */}
          <source src={getBackgroundVideoUrl(media)} type="video/mp4" />
          <source src={`${getBackgroundVideoUrl(media)}?format=webm`} type="video/webm" />
          <source src={`${getBackgroundVideoUrl(media)}?format=mov`} type="video/quicktime" />
          <source src={`${getBackgroundVideoUrl(media)}?format=avi`} type="video/x-msvideo" />
          <source src={`${getBackgroundVideoUrl(media)}?format=mkv`} type="video/x-matroska" />
          <source src={`${getBackgroundVideoUrl(media)}?quality=720p`} type="video/mp4" />
          <source src={`${getBackgroundVideoUrl(media)}?quality=480p`} type="video/mp4" />
          <source src={`${getBackgroundVideoUrl(media)}?quality=360p`} type="video/mp4" />
        </video>

        {/* Enhanced overlay for better readability */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/70 to-black/50 z-15"
          initial={{ opacity: 1 }}
          animate={{ 
            opacity: 1
          }}
          transition={{ 
            duration: 1.2, 
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
        />
        
        {/* Enhanced gradient overlays for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Navigation */}
        <div className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-center">
          <MagneticButton
            onClick={() => router.push('/')}
            className="bg-black/50 backdrop-blur-md text-white p-3 rounded-full hover:bg-black/70 transition-all duration-300"
          >
            <ArrowLeft className="w-6 h-6" />
          </MagneticButton>
          
        </div>

        {/* Netflix Hero Content */}
        <div className="absolute inset-0 flex items-center z-10">
          <div className="container mx-auto px-6 lg:px-12">
            <div className="max-w-4xl">
              {/* Dynamic Title with 3D effects */}
              <div className="mb-6">
                <DynamicTitle
                  media={media}
                  variant="hero"
                  pageType="movie"
                  showGenreIndicator={false}
                  animated={false}
                  enable3D={true}
                  enableParticles={true}
                  particleIntensity="medium"
                  className=""
                />
              </div>

                {/* Description with better readability */}
                <div className="mb-6">
                  <p className="text-white text-lg leading-relaxed drop-shadow-lg">
                    {media.description ? (
                      showFullDescription ? media.description : `${media.description.substring(0, 200)}...`
                    ) : (
                      "Experience the ultimate entertainment with this amazing content. Watch now and immerse yourself in a world of endless possibilities."
                    )}
                    {media.description && media.description.length > 200 && (
                      <button
                        onClick={() => setShowFullDescription(!showFullDescription)}
                        className="text-red-400 hover:text-red-300 ml-2 font-medium"
                      >
                        {showFullDescription ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </p>
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
                      <h3 className="text-lg font-semibold text-white mb-3">Details</h3>
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
              title="More Like This"
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
          onClose={() => setIsPlayerOpen(false)}
          startTime={0}
        />
      )}
    </div>
  );
}
