"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Play, Info, Star, Clock, Calendar, Users } from 'lucide-react';
import Navbar from "@/components/Navbar";
import VideoPlayer from '@/components/VideoPlayer';
import { getApiUrl } from '@/lib/api';
import { Media } from '@/types/media';
import GenreTitle from '@/components/GenreTitle';
import { cleanMovieTitle, findSimilarMovies } from '@/lib/titleUtils';
import { MagneticButton } from '@/components/scrollx';

export default function TVShowPage() {
  const params = useParams();
  const router = useRouter();
  const [media, setMedia] = useState<Media | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [showTitleOverlay, setShowTitleOverlay] = useState(true);
  const [isHoveringTitle, setIsHoveringTitle] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<{browser: string, version: string, mobile: boolean}>({browser: '', version: '', mobile: false});
  const [relatedMedia, setRelatedMedia] = useState<Media[]>([]);

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
      console.log('TV show page - Detected browser:', { browser, version, mobile });
    };
    
    detectBrowser();
  }, []);

  useEffect(() => {
    if (params.id) {
      fetchTVShowData(params.id as string);
    }
  }, [params.id]);

  useEffect(() => {
    if (!loading && media) {
      const timer = setTimeout(() => {
        setShowTitleOverlay(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, media]);

  const fetchTVShowData = async (id: string) => {
    try {
      const apiUrl = getApiUrl();
      
      // Fetch specific TV show
      const response = await fetch(`${apiUrl}/api/media/${id}`);
      if (!response.ok) {
        throw new Error('TV show not found');
      }
      const tvShowData = await response.json();
      setMedia(tvShowData);

      // Fetch all media for related content
      const allMediaResponse = await fetch(`${apiUrl}/api/media`);
      const allMedia = await allMediaResponse.json();
      
      // Find related TV shows
      const related = findSimilarMovies(tvShowData, allMedia)
        .filter(item => item.type === 'episode' || item.type === 'tv')
        .slice(0, 12);
      setRelatedMedia(related);

    } catch (error) {
      console.error("Error fetching TV show:", error);
      router.push('/tv-series');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (mediaItem?: Media) => {
    const playMedia = mediaItem || media;
    if (playMedia) {
      setSelectedMedia(playMedia);
      setIsPlayerOpen(true);
    }
  };

  const handleInfo = (mediaItem: Media) => {
    router.push(`/tv-show/${mediaItem.id}`);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatFileSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading TV Show...</div>
      </div>
    );
  }

  if (!media) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">TV Show not found</div>
      </div>
    );
  }

  const cleanTitle = cleanMovieTitle(media.title);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar onSearch={() => {}} />
      
      {/* Hero Section with Video Background */}
      <div className="relative h-screen overflow-hidden">
        {/* Netflix-style Background Video */}
        <video
          autoPlay={browserInfo.browser !== 'chrome'}
          muted={browserInfo.browser === 'chrome' || browserInfo.browser === 'firefox'}
          loop={false}
          playsInline
          preload="auto"
          webkit-playsinline="true"
          x5-playsinline="true"
          crossOrigin="anonymous"
          className="absolute inset-0 w-full h-full object-cover"
          onCanPlay={(e) => {
            const video = e.currentTarget;
            
            // Check for ALAC codec support
            const alacSupport = video.canPlayType('video/mp4; codecs="avc1.42E01E, alac"');
            console.log('TV show ALAC codec support:', alacSupport);
            
            video.currentTime = 0;
            video.volume = 0.8;
            
            // Browser-specific video playback strategies for TV show page
            const attemptPlayback = async () => {
              // Force immediate setup
              video.currentTime = 0;
              video.volume = 0.8;
              
              // Check video codec support
              const codecSupport = {
                mp4: video.canPlayType('video/mp4'),
                webm: video.canPlayType('video/webm'),
                h264: video.canPlayType('video/mp4; codecs="avc1.42E01E"'),
                vp9: video.canPlayType('video/webm; codecs="vp9"'),
                alac: video.canPlayType('video/mp4; codecs="avc1.42E01E, alac"')
              };
              
              console.log('TV show page - Video codec support:', codecSupport);
              console.log('TV show page - Browser info:', browserInfo);
              
              // Define browser-specific strategies
              const strategies = [];
              
              // Strategy for Safari (best ALAC support)
              if (browserInfo.browser === 'safari') {
                strategies.push(
                  async () => {
                    video.muted = false;
                    video.setAttribute('autoplay', 'true');
                    video.setAttribute('playsinline', 'true');
                    await video.play();
                    console.log('TV show Safari: Video playing with audio');
                    return true;
                  }
                );
              }
              
              // Strategy for Chrome/Chromium (strict autoplay policy)
              if (browserInfo.browser === 'chrome') {
                strategies.push(
                  async () => {
                    // Force muted for Chrome autoplay policy
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
                    console.log('TV show Chrome: Video playing (muted)');
                    
                    // Add comprehensive interaction handlers
                    const unlockAudio = () => {
                      video.muted = false;
                      video.volume = 0.8;
                      console.log('TV show Chrome: Audio unlocked');
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
                    console.log('TV show Firefox: Video playing (muted)');
                    
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
                  console.log('TV show Universal: Muted autoplay successful');
                  
                  // Universal interaction unlock
                  const unlockAudio = () => {
                    video.muted = false;
                    video.volume = 0.8;
                    console.log('TV show Universal: Audio unlocked');
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
                  console.log('TV show Force load: Video playing');
                  return true;
                },
                // Last resort: manual trigger
                async () => {
                  console.log('TV show Manual trigger required for video playback');
                  video.muted = true;
                  
                  const playButton = document.createElement('button');
                  playButton.textContent = '▶ Play TV Video';
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
                      console.log('TV show Manual: Video playing with audio');
                    } catch (e) {
                      console.error('TV show Manual play failed:', e);
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
                    console.log('TV show play request was aborted, ignoring error');
                    return;
                  }
                  console.warn('TV show strategy failed, trying next:', error);
                  continue;
                }
              }
              
              // All strategies failed
              console.error('All TV show video playback strategies failed for:', media.title);
            };
            
            // Browser-specific delay
            const delay = browserInfo.browser === 'chrome' ? 300 : 
                         browserInfo.browser === 'firefox' ? 200 : 100;
            setTimeout(attemptPlayback, delay);
          }}
          onEnded={(e) => {
            const video = e.currentTarget;
            console.log('TV show background video ended:', media.title);
            // Don't restart - let it stay on the last frame
            video.currentTime = video.duration - 0.1;
          }}
        >
          {/* ALAC format sources with high-quality audio */}
          <source src={`${getApiUrl()}/api/stream/${media.id}?audio_codec=alac&audio_quality=lossless`} type='video/mp4; codecs="avc1.42E01E, alac"' />
          <source src={`${getApiUrl()}/api/stream/${media.id}?audio_codec=alac&audio_quality=lossless`} type='video/mp4; codecs="avc1.640028, alac"' />
          <source src={`${getApiUrl()}/api/stream/${media.id}?format=mov&audio_codec=alac`} type='video/quicktime; codecs="avc1.42E01E, alac"' />
          {/* Standard format fallbacks */}
          <source src={`${getApiUrl()}/api/stream/${media.id}`} type="video/mp4" />
          <source src={`${getApiUrl()}/api/stream/${media.id}?format=webm&audio=opus`} type='video/webm; codecs="vp9, opus"' />
          <source src={`${getApiUrl()}/api/stream/${media.id}?quality=720p`} type="video/mp4" />
          <source src={`${getApiUrl()}/api/stream/${media.id}?quality=480p`} type="video/mp4" />
        </video>

        {/* Netflix-style gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Netflix Hero Content */}
        <div className="absolute inset-0 flex items-center z-10">
          <div className="container mx-auto px-6 lg:px-12">
            <div className="max-w-4xl">
              {/* Netflix badges */}
              <motion.div
                className="flex items-center gap-3 mb-4"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: showTitleOverlay ? 1 : 0, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="bg-red-600 text-white px-3 py-1 text-sm font-bold rounded">
                  SERIES
                </div>
                {media.genres && media.genres.length > 0 && (
                  <div className="flex gap-2">
                    {media.genres.slice(0, 3).map((genre, index) => (
                      <span key={index} className="text-gray-300 text-sm border border-gray-500 px-2 py-1 rounded">
                        {String(genre).toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
              
              {/* Title */}
              <motion.h1 
                className={`text-white font-bold mb-4 leading-tight ${
                  cleanTitle.length > 20 ? 'text-4xl lg:text-5xl' : 'text-5xl lg:text-7xl'
                }`}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: showTitleOverlay ? 1 : 0, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                {cleanTitle}
              </motion.h1>
              
              {/* Netflix metadata */}
              <motion.div 
                className="flex items-center gap-4 mb-6 text-sm text-gray-300"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: showTitleOverlay ? 1 : 0, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                {media.release_date && (
                  <span className="text-green-400 font-semibold">
                    {new Date(media.release_date).getFullYear()}
                  </span>
                )}
                {media.rating && (
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400">★</span>
                    <span>{media.rating.toFixed(1)}</span>
                  </div>
                )}
                {media.season && (
                  <span>{media.season} Season{media.season > 1 ? 's' : ''}</span>
                )}
                <div className="border border-gray-500 px-2 py-0.5 text-xs">
                  HD
                </div>
              </motion.div>
              {/* Netflix Description */}
              <motion.div
                className="mb-8"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: showTitleOverlay ? 1 : 0, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                <p className="text-lg text-white mb-4 leading-relaxed max-w-3xl font-light">
                  {media.description || 'No description available.'}
                </p>
                
                {/* Cast/Director info */}
                {media.director && (
                  <div className="text-sm text-gray-400 space-y-1">
                    <div>
                      <span className="text-gray-500">Creator: </span>
                      <span className="text-white">{media.director}</span>
                    </div>
                  </div>
                )}
              </motion.div>
              
              {/* Netflix Action Buttons */}
              <motion.div 
                className="flex items-center gap-3 mb-8"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: showTitleOverlay ? 1 : 0, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                {/* Primary Play Button */}
                <button
                  onClick={() => handlePlay()}
                  className="bg-white text-black px-8 py-3 rounded-sm font-bold text-lg hover:bg-gray-200 transition-all duration-200 flex items-center gap-3 shadow-lg"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Play
                </button>

                {/* Secondary More Info Button */}
                <button
                  onClick={() => setSelectedMedia(media)}
                  className="bg-gray-500/70 text-white px-8 py-3 rounded-sm font-semibold text-lg hover:bg-gray-500/90 transition-all duration-200 flex items-center gap-3"
                >
                  <Info className="w-5 h-5" />
                  More Info
                </button>
                
                {/* Netflix icon buttons */}
                <div className="flex items-center gap-2 ml-4">
                  <button className="w-10 h-10 rounded-full border-2 border-gray-400 flex items-center justify-center hover:border-white transition-colors duration-200">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                  </button>
                  
                  <button className="w-10 h-10 rounded-full border-2 border-gray-400 flex items-center justify-center hover:border-white transition-colors duration-200">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                  
                  <button className="w-10 h-10 rounded-full border-2 border-gray-400 flex items-center justify-center hover:border-white transition-colors duration-200">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Related TV Shows Section */}
      {relatedMedia.length > 0 && (
        <div className="py-12 px-6">
          <div className="container mx-auto">
            <h2 className="text-2xl font-bold mb-8">More Like This</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {relatedMedia.map((item) => (
                <motion.div
                  key={item.id}
                  className="group cursor-pointer"
                  whileHover={{ scale: 1.05 }}
                  onClick={() => handleInfo(item)}
                >
                  <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden">
                    <img
                      src={`${getApiUrl()}/api/thumbnail/${item.id}`}
                      alt={cleanMovieTitle(item.title)}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-poster.jpg';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <h3 className="text-white font-semibold text-sm mb-1 line-clamp-2">
                        {cleanMovieTitle(item.title)}
                      </h3>
                      {item.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-400" />
                          <span className="text-xs text-gray-300">{item.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {selectedMedia && (
        <VideoPlayer
          media={selectedMedia}
          isOpen={isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
          startTime={0}
        />
      )}
    </div>
  );
}
