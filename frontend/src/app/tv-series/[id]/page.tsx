"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePageTitle } from '@/hooks/usePageTitle';
import { ArrowLeft, Play, Plus, Check, Share, Download, Info, Star, Clock, Calendar, Globe, Users, Award, Film, Tv, User, Mic, ChevronDown, ChevronUp, Volume2, VolumeX, PlayCircle, X, Pause } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import RedLoader from '@/components/RedLoader';
import LazyImage from '@/components/LazyImage';
import LazyVideo from '@/components/LazyVideo';
import Navbar from '@/components/Navbar';
import VideoPlayer from '@/components/VideoPlayer';
import NetflixMediaCard from '@/components/NetflixMediaCard';
import {
  ParallaxSection,
  ScrollReveal,
  GlassCard,
  GradientBackground,
  FloatingElement,
  MagneticButton,
  ParticleField
} from '@/components/scrollx';
import { useNavigate } from "@/hooks/useNavigate";
import ImageWithFallback from '@/components/ImageWithFallback';
import { useMyList } from '@/hooks/useMyList';
import MyListTooltip from '@/components/ui/MyListTooltip';

interface Season {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  air_date?: string;
  episode_count: number;
  episodes?: Episode[];
}

interface Episode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path?: string;
  air_date?: string;
  runtime?: number;
  vote_average?: number;
}

export default function TVSeriesPage() {
  const params = useParams();
  const router = useRouter();
  const navigate = useNavigate();
  const [series, setSeries] = useState<Media | null>(null);

  // Update page title when series is loaded
  usePageTitle(series?.title || 'TV Series');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Media[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isInMyList, setIsInMyList] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showTitleOverlay, setShowTitleOverlay] = useState(true);
  const [isHoveringTitle, setIsHoveringTitle] = useState(false);
  const [continueWatching, setContinueWatching] = useState<{ episode: Media, progress: number } | null>(null);
  const [isShowingTrailer, setIsShowingTrailer] = useState(false); // Trailer mode state
  const [trailerKey, setTrailerKey] = useState<string | null>(null); // YouTube trailer key
  const [showControls, setShowControls] = useState(true); // Show/hide trailer controls
  const [trailerLoaded, setTrailerLoaded] = useState(false); // Track if trailer iframe is loaded
  const [trailerReady, setTrailerReady] = useState(false); // Track if trailer is ready to play
  const [userPausedTrailer, setUserPausedTrailer] = useState(false); // Track if user manually paused trailer
  const videoRef = useRef<HTMLVideoElement>(null);
  const trailerRef = useRef<HTMLIFrameElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use the new backend-connected My List hook
  const { myList, collections, isInMyList: isInMyListHook, toggleMyList: toggleMyListHook, addToCollection, fetchCollections } = useMyList();

  useEffect(() => {
    if (params.id) {
      fetchSeriesData();
      checkMyList();
    }
  }, [params.id]);

  useEffect(() => {
    if (!loading && series) {
      const timer = setTimeout(() => {
        setShowTitleOverlay(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, series]);

  const fetchSeriesData = async () => {
    try {
      const apiUrl = getApiUrl();
      console.log('🔍 Fetching series data for ID:', params.id);

      // First try to get series info from the series API
      let seriesData = null;
      try {
        const seriesResponse = await fetch(`${apiUrl}/api/series/${params.id}`);
        if (seriesResponse.ok) {
          seriesData = await seriesResponse.json();
          console.log('✅ Found series data:', seriesData);
        }
      } catch (error) {
        console.warn('Series API not available, trying media API');
      }

      // If no series found, try to get it from media API
      if (!seriesData) {
        try {
          const mediaResponse = await fetch(`${apiUrl}/api/media/${params.id}`);
          if (mediaResponse.ok) {
            seriesData = await mediaResponse.json();
            console.log('✅ Found media data:', seriesData);
          }
        } catch (error) {
          console.warn('Media API failed:', error);
        }
      }

      // If still no series data, try to build it from episodes
      if (!seriesData) {
        console.log('🔍 Building series data from episodes...');
        const allMediaResponse = await fetch(`${apiUrl}/api/media`);
        const allMedia = await allMediaResponse.json();

        // Find episodes that might belong to this series
        const possibleEpisodes = allMedia.filter((media: Media) =>
          media.type === 'episode' && (
            media.series_id?.toString() === params.id?.toString() ||
            media.id?.toString() === params.id?.toString()
          )
        );

        if (possibleEpisodes.length > 0) {
          // Create series data from first episode
          const firstEpisode = possibleEpisodes[0];
          seriesData = {
            id: params.id,
            title: firstEpisode.series?.title || firstEpisode.title.replace(/\s*-\s*S\d+E\d+.*$/i, '') || 'Unknown Series',
            description: firstEpisode.series?.description || firstEpisode.description || '',
            rating: firstEpisode.rating || 0,
            type: 'series',
            thumbnail_path: firstEpisode.thumbnail_path,
            banner_path: firstEpisode.banner_path,
            genres: firstEpisode.genres || []
          };
          console.log('✅ Built series data from episodes:', seriesData);
        }
      }

      if (!seriesData) {
        console.error('❌ No series data found for ID:', params.id);
        setLoading(false);
        return;
      }

      setSeries(seriesData);

      // Get all episodes for this series
      const allMediaResponse = await fetch(`${apiUrl}/api/media`);
      const allMedia = await allMediaResponse.json();

      // Filter episodes that belong to this series
      const seriesEpisodes = allMedia.filter((media: Media) => {
        return media.type === 'episode' && (
          media.series_id?.toString() === params.id?.toString() ||
          (seriesData.title && media.title.toLowerCase().includes(seriesData.title.toLowerCase())) ||
          (media.file_path && seriesData.file_path &&
            media.file_path.includes(seriesData.file_path.split('/').slice(0, -1).join('/')))
        );
      });

      console.log('🔍 Found episodes:', seriesEpisodes.length);
      setEpisodes(seriesEpisodes);

      // Group episodes by season
      const seasonMap = new Map<number, Episode[]>();
      seriesEpisodes.forEach((episode: Media) => {
        const seasonNum = extractSeasonNumber(episode.title) || 1;
        if (!seasonMap.has(seasonNum)) {
          seasonMap.set(seasonNum, []);
        }
        seasonMap.get(seasonNum)?.push({
          id: episode.id,
          episode_number: extractEpisodeNumber(episode.title) || 1,
          name: episode.title,
          overview: episode.description || '',
          still_path: episode.thumbnail_path,
          air_date: episode.release_date,
          runtime: episode.duration ? Math.floor(episode.duration / 60) : undefined,
          vote_average: episode.rating
        });
      });

      // Create seasons array
      const seasonsArray: Season[] = Array.from(seasonMap.entries()).map(([seasonNum, eps]) => ({
        id: seasonNum,
        season_number: seasonNum,
        name: `Season ${seasonNum}`,
        overview: `Season ${seasonNum} of ${seriesData.title}`,
        episode_count: eps.length,
        episodes: eps.sort((a, b) => a.episode_number - b.episode_number)
      }));

      setSeasons(seasonsArray.sort((a, b) => a.season_number - b.season_number));

      // Load continue watching after episodes are set
      if (seriesEpisodes.length > 0) {
        // Check for continue watching episode
        const episodeWithProgress = seriesEpisodes.find((ep: Media) => {
          const progress = localStorage.getItem(`progress_${ep.id}`);
          return progress && JSON.parse(progress).progress > 0;
        });

        if (episodeWithProgress) {
          const progressData = JSON.parse(localStorage.getItem(`progress_${episodeWithProgress.id}`) || '{}');
          setContinueWatching({
            episode: episodeWithProgress,
            progress: progressData.progress || 0
          });
        }

        // Preload assets for better performance
        preloadAssets(seriesEpisodes.slice(0, 12), ['thumbnail']);
      }

    } catch (error) {
      console.error('Error fetching series data:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractSeasonNumber = (title: string): number | null => {
    const seasonMatch = title.match(/[Ss](\d+)[Ee](\d+)|[Ss]eason\s*(\d+)/i);
    if (seasonMatch) {
      return parseInt(seasonMatch[1] || seasonMatch[3]);
    }
    return null;
  };

  const extractEpisodeNumber = (title: string): number | null => {
    const episodeMatch = title.match(/[Ss](\d+)[Ee](\d+)|[Ee]pisode\s*(\d+)/i);
    if (episodeMatch) {
      return parseInt(episodeMatch[2] || episodeMatch[3]);
    }
    return null;
  };

  const checkMyList = () => {
    // Implementation for checking if series is in user's list
    setIsInMyList(false);
  };



  const handlePlay = (media?: Media) => {
    if (media) {
      setSelectedMedia(media);
    } else if (continueWatching) {
      setSelectedMedia(continueWatching.episode);
    } else if (episodes.length > 0) {
      // Start with first episode of first season
      setSelectedMedia(episodes[0]);
    }
    setIsPlayerOpen(true);
  };

  const handleSeasonSelect = (seasonNumber: number) => {
    setSelectedSeason(seasonNumber);
    navigate.push(`/tv-series/${params.id}/season/${seasonNumber}`);
  };

  const toggleMyList = () => {
    setIsInMyList(!isInMyList);
  };

  const getBackgroundImageUrl = (media: Media) => {
    const apiUrl = getApiUrl();
    console.log('🖼️ Getting background image for:', media.title);

    // First try TMDB backdrop if available (high priority for backdrop)
    // Prefer locally hosted series backdrop endpoint
    if (media.backdrop_path && media.id) {
      const backdropEndpoint = `${apiUrl}/api/series/${media.id}/backdrop`;
      console.log('🖼️ Using local series backdrop endpoint');
      return backdropEndpoint;
    }

    if (media.tmdb_backdrop_url) {
      console.log('🖼️ Using TMDB backdrop');
      return media.tmdb_backdrop_url;
    }

    if (media.banner_path) {
      console.log('🖼️ Using series banner');
      return `${apiUrl}/api/admin/assets/${media.banner_path.split('/').pop()}`;
    }

    // Use random season thumbnail as background if seasons exist
    if (seasons.length > 0 && episodes.length > 0) {
      const randomSeason = seasons[Math.floor(Math.random() * seasons.length)];
      if (randomSeason.episodes && randomSeason.episodes.length > 0) {
        const randomEpisode = randomSeason.episodes[Math.floor(Math.random() * randomSeason.episodes.length)];
        const episodeMedia = episodes.find(ep => ep.id === randomEpisode.id);
        if (episodeMedia) {
          console.log('🖼️ Using random episode thumbnail:', episodeMedia.id);
          return `${apiUrl}/api/thumbnails/${episodeMedia.id}`;
        }
      }
    }

    // Fallback to series thumbnail
    console.log('🖼️ Using series thumbnail:', media.id);
    return media.id ? `${apiUrl}/api/thumbnails/${media.id}` : `${apiUrl}/api/thumbnails/${params.id}`;
  };

  const getBackdropImageUrl = (media: Media) => {
    const apiUrl = getApiUrl();

    // First try TMDB backdrop if available (high priority for backdrop)
    // Prefer local series backdrop endpoint
    if (media.backdrop_path && media.id) {
      return `${apiUrl}/api/series/${media.id}/backdrop`;
    }

    if (media.tmdb_backdrop_url) {
      return media.tmdb_backdrop_url;
    }

    if (media.banner_path) {
      return `${apiUrl}/api/admin/assets/${media.banner_path.split('/').pop()}`;
    }

    // Fallback to thumbnail (not poster for backdrop)
    return `${apiUrl}/api/thumbnails/${media.id}`;
  };

  const getBackgroundVideoUrl = (media: Media) => {
    const apiUrl = getApiUrl();

    // Then try local trailer
    if (media.trailer_path) {
      return `${apiUrl}/api/admin/assets/${media.trailer_path.split('/').pop()}`;
    }

    // Then try preview clips
    if (media.preview_clip_path) {
      return `${apiUrl}/api/admin/assets/${media.preview_clip_path.split('/').pop()}`;
    }

    // Fallback to preview clips endpoint
    return `${apiUrl}/api/preview-clips/${media.id}`;
  };

  const extractYouTubeKey = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  };

  const handleWatchTrailer = () => {
    if (!series?.tmdb_trailer_url) return;

    const key = extractYouTubeKey(series.tmdb_trailer_url);
    if (key) {
      setTrailerKey(key);
      setIsShowingTrailer(true);
      // Stop background video when showing trailer
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.muted = true;
        video.volume = 0;
        setIsVideoPlaying(false);
      }
    }
  };

  const handleCloseTrailer = () => {
    setIsShowingTrailer(false);
    setTrailerKey(null);
    // Show backdrop image when trailer closes (don't auto-resume video)
    setTimeout(() => {
      const video = videoRef.current;
      if (video && series && !isPlayerOpen) {
        // Don't auto-play video when trailer closes, show backdrop instead
        video.pause();
        video.currentTime = 0;
        setIsVideoPlaying(false);
      }
    }, 100);
  };

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RedLoader />
      </div>
    );
  }

  if (!series) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-6">
        <h1 className="text-4xl font-bold text-white mb-4">Series Not Found</h1>
        <p className="text-xl text-white/80 mb-8">The requested TV series could not be found.</p>
        <button
          onClick={() => router.back()}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-900/20 via-black to-black text-white">
      <Navbar />
      <GradientBackground variant="cosmic" animate={true} className="fixed inset-0 -z-10" />

      {/* Hero Section */}
      <div className="relative h-screen overflow-hidden">
        {/* Backdrop Background Image - Shows when video not playing */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${!isVideoLoaded || !isVideoPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          style={{ zIndex: 2 }}
        >
          <img
            src={getBackdropImageUrl(series)}
            alt={series.title}
            className="w-full h-full object-cover"
            loading="eager"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const apiUrl = getApiUrl();
              target.src = `${apiUrl}/api/thumbnails/${series?.id || 'default'}`;
            }}
          />
        </div>

        {/* Background Video */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted={false}
          loop
          playsInline
          preload="metadata"
          style={{ zIndex: 5 }}
          onLoadedData={() => {
            setIsVideoLoaded(true);
            if (videoRef.current) {
              videoRef.current.volume = 0.6;
              videoRef.current.play().then(() => {
                setIsVideoPlaying(true);
              }).catch(() => {
                videoRef.current!.muted = true;
                videoRef.current!.play();
              });
            }
          }}
          onError={() => {
            setIsVideoLoaded(false);
            setIsVideoPlaying(false);
          }}
        >
          <source src={`${getBackgroundVideoUrl(series)}?audio=aac&quality=medium`} type="video/mp4" />
          <source src={getBackgroundVideoUrl(series)} type="video/mp4" />
        </video>

        {/* YouTube Trailer Overlay - Netflix Style with Custom Controls */}
        {isShowingTrailer && trailerKey && (
          <div
            className="absolute inset-0 z-[15] bg-black cursor-pointer"
            onMouseMove={() => {
              // Ensure background video is stopped when interacting with trailer
              const video = videoRef.current;
              if (video) {
                video.pause();
                video.muted = true;
                video.volume = 0;
                video.currentTime = 0;
                video.style.display = 'none';
                video.style.visibility = 'hidden';
                video.style.opacity = '0';
              }

              setShowControls(true);
              // Clear existing timeout
              if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
              }
              // Auto-hide controls after 3 seconds when playing
              if (isVideoPlaying) {
                controlsTimeoutRef.current = setTimeout(() => {
                  setShowControls(false);
                }, 3000);
              }
            }}
            onMouseLeave={() => {
              // Clear existing timeout
              if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
              }
              // Hide controls when mouse leaves if video is playing
              if (isVideoPlaying) {
                controlsTimeoutRef.current = setTimeout(() => {
                  setShowControls(false);
                }, 1000);
              }
            }}
            onClick={(e) => {
              // Only toggle play/pause if clicking on the overlay itself, not the controls
              if (e.target === e.currentTarget) {
                // Toggle play/pause on backdrop click
                if (trailerRef.current && trailerReady) {
                  const iframe = trailerRef.current;
                  if (isVideoPlaying) {
                    iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                    setIsVideoPlaying(false);
                    setUserPausedTrailer(true);
                  } else {
                    iframe.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                    setIsVideoPlaying(true);
                    setUserPausedTrailer(false);
                  }
                  setShowControls(true);

                  // Clear existing timeout
                  if (controlsTimeoutRef.current) {
                    clearTimeout(controlsTimeoutRef.current);
                  }
                  // Auto-hide controls after 3 seconds when playing
                  if (!isVideoPlaying) {
                    controlsTimeoutRef.current = setTimeout(() => {
                      setShowControls(false);
                    }, 3000);
                  }
                }
              }
            }}
          >
            <iframe
              ref={trailerRef}
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=0&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1&loop=1&playlist=${trailerKey}&origin=${typeof window !== 'undefined' ? window.location.origin : ''}&vq=hd1080&hd=1&quality=hd1080`}
              className={`w-full h-full transition-opacity duration-500 ${trailerLoaded && trailerReady ? 'opacity-100' : 'opacity-0'}`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{
                pointerEvents: 'none',
                border: 'none',
                outline: 'none'
              }}
              onLoad={() => {
                setTrailerLoaded(true);
                // Initialize YouTube API communication and auto-play with sound
                setTimeout(() => {
                  if (trailerRef.current && !userPausedTrailer) {
                    trailerRef.current.contentWindow?.postMessage('{"event":"listening","id":"trailer"}', '*');
                    // Force unmute and play
                    trailerRef.current.contentWindow?.postMessage('{"event":"command","func":"unMute","args":""}', '*');
                    trailerRef.current.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                    setIsVideoPlaying(true);
                    setTrailerReady(true);
                  }
                }, 1000);
              }}
            />

            {/* Show backdrop image when video is paused or not loaded */}
            {(!trailerLoaded || !trailerReady || !isVideoPlaying) && (
              <div
                className="absolute inset-0 z-[10] bg-cover bg-center bg-no-repeat transition-opacity duration-500"
                style={{
                  backgroundImage: `url(${getBackdropImageUrl(series)})`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-black/20" />
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

                {/* Loading indicator when trailer is loading */}
                {!trailerLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/70 backdrop-blur-sm rounded-full p-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                  </div>
                )}

                {/* Play button when trailer is ready but paused */}
                {trailerLoaded && trailerReady && !isVideoPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      onClick={() => {
                        if (trailerRef.current) {
                          trailerRef.current.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                          setIsVideoPlaying(true);
                          setUserPausedTrailer(false);
                          setShowControls(true);
                        }
                      }}
                      className="bg-red-600/90 backdrop-blur-sm rounded-full p-6 hover:bg-red-700/90 transition-all duration-300 hover:scale-110"
                    >
                      <Play className="w-12 h-12 text-white fill-current" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

            {/* Trailer Controls - Netflix Style */}
            <AnimatePresence>
              {showControls && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 pointer-events-none z-[25]"
                >
                  {/* Close button - Top right */}
                  <div className="absolute top-8 right-8 z-[30] pointer-events-auto">
                    <button
                      onClick={handleCloseTrailer}
                      className="p-3 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-all duration-300 hover:scale-110"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Trailer Label - Top left */}
                  <div className="absolute top-8 left-8 z-[30] bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg pointer-events-none">
                    <span className="text-sm font-semibold">Official Trailer</span>
                  </div>

                  {/* Video Controls - Bottom right */}
                  <div className="absolute bottom-8 right-8 z-[30] flex gap-3 pointer-events-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (trailerRef.current && trailerReady) {
                          const iframe = trailerRef.current;
                          if (isVideoPlaying) {
                            iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                            setIsVideoPlaying(false);
                            setUserPausedTrailer(true);
                          } else {
                            iframe.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                            setIsVideoPlaying(true);
                            setUserPausedTrailer(false);
                          }
                          setShowControls(true);

                          // Clear existing timeout
                          if (controlsTimeoutRef.current) {
                            clearTimeout(controlsTimeoutRef.current);
                          }
                          // Auto-hide controls after 3 seconds when playing
                          if (!isVideoPlaying) {
                            controlsTimeoutRef.current = setTimeout(() => {
                              setShowControls(false);
                            }, 3000);
                          }
                        }
                      }}
                      className="p-3 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-all duration-300 hover:scale-110"
                      disabled={!trailerReady}
                    >
                      {isVideoPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (trailerRef.current && trailerReady) {
                          const iframe = trailerRef.current;
                          const video = videoRef.current;
                          if (video) {
                            if (video.muted) {
                              // Unmute
                              iframe.contentWindow?.postMessage('{"event":"command","func":"unMute","args":""}', '*');
                              video.muted = false;
                            } else {
                              // Mute
                              iframe.contentWindow?.postMessage('{"event":"command","func":"mute","args":""}', '*');
                              video.muted = true;
                            }
                          }
                          setShowControls(true);

                          // Clear existing timeout
                          if (controlsTimeoutRef.current) {
                            clearTimeout(controlsTimeoutRef.current);
                          }
                          // Keep controls visible for a bit after mute/unmute
                          controlsTimeoutRef.current = setTimeout(() => {
                            if (isVideoPlaying) {
                              setShowControls(false);
                            }
                          }, 3000);
                        }
                      }}
                      className="p-3 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-all duration-300 hover:scale-110"
                      disabled={!trailerReady}
                    >
                      {videoRef.current?.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Bottom gradient for text readability only */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10" />

        {/* Hero Content - Bottom Left with Poster (TMDB Style) */}
        <div className="absolute bottom-0 left-0 z-[20] p-8 pointer-events-auto w-full">
          <div
            className="flex gap-6 items-end"
            onMouseEnter={() => setIsHoveringTitle(true)}
            onMouseLeave={() => setIsHoveringTitle(false)}
          >
            <ParticleField count={50} className="absolute inset-0 opacity-30 pointer-events-none" />

            {/* Series Poster */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex-shrink-0 hidden md:block"
            >
              <div className="relative w-48 lg:w-64 h-72 lg:h-96 rounded-lg overflow-hidden shadow-2xl border border-white/10">
                {/* Use series poster with proper fallback chain */}
                <img
                  src={series.tmdb_poster_url || `${getApiUrl()}/api/series/${series.id}/poster`}
                  alt={series.title}
                  className="w-full h-full object-cover"
                  loading="eager"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const apiUrl = getApiUrl();
                    // Fallback chain: TMDB poster -> series poster -> series thumbnail -> gradient
                    if (series.tmdb_poster_url && !target.src.includes('tmdb')) {
                      target.src = series.tmdb_poster_url;
                    } else if (!target.src.includes('/api/series/') && !target.src.includes('/poster')) {
                      target.src = `${apiUrl}/api/series/${series.id}/poster`;
                    } else if (!target.src.includes('/api/thumbnails/')) {
                      target.src = `${apiUrl}/api/thumbnails/${series.id}`;
                    } else {
                      // Final fallback: Show gradient
                      const parent = target.parentElement!;
                      parent.innerHTML = `
                        <div class="w-full h-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                          <span class="text-4xl font-bold text-white">${series.title.charAt(0)}</span>
                        </div>
                      `;
                    }
                  }}
                />
              </div>
            </motion.div>

            {/* Series Details */}
            <div className="flex-1 space-y-4 pb-4">
              {/* Series Title */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Tv className="w-6 h-6 text-red-500" />
                  <span className="text-red-400 font-semibold text-sm">TV SERIES</span>
                </div>

                {/* Series Title - Logo or Text */}
                <img
                  src={`${getApiUrl()}/api/series/${series.id}/logo`}
                  alt={series.title}
                  className="max-h-20 md:max-h-28 w-auto mb-3 drop-shadow-2xl"
                  style={{ display: series.logo_path ? 'block' : 'none' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
                <h1
                  className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 leading-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent"
                  style={{ display: series.logo_path ? 'none' : 'block' }}
                >
                  {series.title}
                </h1>

                <div className="text-white/80 text-base font-medium mb-3">
                  {seasons.length} Season{seasons.length !== 1 ? 's' : ''} • {episodes.length} Episodes
                </div>
              </motion.div>

              {/* Continue Watching */}
              {continueWatching && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{
                    opacity: (!showTitleOverlay || isHoveringTitle) ? 1 : 0,
                    y: (!showTitleOverlay || isHoveringTitle) ? 0 : 30
                  }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="mb-4"
                >
                  <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 border border-white/20">
                    <div className="flex items-center gap-2 mb-1">
                      <PlayCircle className="w-4 h-4 text-red-400" />
                      <span className="text-white font-medium text-sm">Continue Watching</span>
                    </div>
                    <p className="text-white/80 text-xs">
                      {continueWatching.episode.title} • {Math.round((continueWatching.progress / (continueWatching.episode.duration || 1)) * 100)}% complete
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Stats Row - Compact */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{
                  opacity: (!showTitleOverlay || isHoveringTitle) ? 1 : 0,
                  y: (!showTitleOverlay || isHoveringTitle) ? 0 : 30
                }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex flex-wrap items-center gap-2 text-sm mb-3"
              >
                {series.rating && (
                  <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-1 rounded-full">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="font-semibold">{series.rating.toFixed(1)}</span>
                  </div>
                )}

                <div className="flex items-center gap-1 bg-blue-500/20 px-2 py-1 rounded-full">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span>{series.year || new Date().getFullYear()}</span>
                </div>
              </motion.div>

              {/* Genres - Compact */}
              {series.genres && series.genres.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{
                    opacity: (!showTitleOverlay || isHoveringTitle) ? 1 : 0,
                    y: (!showTitleOverlay || isHoveringTitle) ? 0 : 30
                  }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  className="flex flex-wrap gap-1 mb-3"
                >
                  {series.genres.slice(0, 3).map((genre, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-red-600/30 border border-red-500/50 rounded-full text-xs font-medium"
                    >
                      {typeof genre === 'string' ? genre : genre?.name || 'Unknown'}
                    </span>
                  ))}
                </motion.div>
              )}

              {/* Action Buttons - Compact */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{
                  opacity: (!showTitleOverlay || isHoveringTitle) ? 1 : 0,
                  y: (!showTitleOverlay || isHoveringTitle) ? 0 : 30
                }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap gap-2 mb-4"
              >
                <button
                  onClick={() => handlePlay()}
                  className="flex items-center gap-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
                >
                  <Play className="w-4 h-4" />
                  {continueWatching ? 'Continue' : 'Play'}
                </button>

                {/* Watch Trailer Button - Only show if TMDB trailer is available */}
                {series.tmdb_trailer_url && (
                  <button
                    onClick={handleWatchTrailer}
                    className="flex items-center gap-1 px-4 py-2 bg-blue-600/80 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
                  >
                    <Play className="w-4 h-4" />
                    Watch Trailer
                  </button>
                )}

                <MyListTooltip
                  media={series}
                  isInMyList={isInMyListHook(series.id)}
                  collections={collections}
                  onToggleMyList={() => toggleMyListHook(series.id)}
                  onAddToCollection={(collectionId) => addToCollection(collectionId, series.id)}
                  onCollectionCreated={fetchCollections}
                >
                  <button className="flex items-center gap-1 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105">
                    {isInMyListHook(series.id) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    Watchlist
                  </button>
                </MyListTooltip>

                <button className="flex items-center gap-1 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105">
                  <Share className="w-4 h-4" />
                  Share
                </button>
              </motion.div>

              {/* Description - Compact */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{
                  opacity: (!showTitleOverlay || isHoveringTitle) ? 1 : 0,
                  y: (!showTitleOverlay || isHoveringTitle) ? 0 : 30
                }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <p className="text-sm text-gray-300 leading-relaxed line-clamp-3">
                  {series.description || "Experience this amazing TV series with compelling characters and engaging storylines that will keep you watching episode after episode."}
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Seasons Section */}
      <div className="relative z-10 bg-black pt-16 pb-24">
        <div className="container mx-auto px-6 md:px-12 lg:px-16">
          <ScrollReveal direction="up" delay={0.2}>
            <h2 className="text-3xl font-bold text-white mb-8">Seasons</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {seasons.sort((a, b) => a.season_number - b.season_number).map((season) => {
                return (
                  <motion.div
                    key={season.id}
                    className="group cursor-pointer"
                    onClick={() => handleSeasonSelect(season.season_number)}
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden mb-3 group-hover:scale-105 transition-transform duration-300">
                      {/* Use series poster for seasons */}
                      <img
                        src={series.tmdb_poster_url || `${getApiUrl()}/api/series/${series.id}/poster`}
                        alt={`${series?.title} ${season.name}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const apiUrl = getApiUrl();
                          // Fallback chain: TMDB poster -> series poster -> series thumbnail -> gradient
                          if (series.tmdb_poster_url && !target.src.includes('tmdb')) {
                            target.src = series.tmdb_poster_url;
                          } else if (!target.src.includes('/api/series/') && !target.src.includes('/poster')) {
                            target.src = `${apiUrl}/api/series/${series.id}/poster`;
                          } else if (!target.src.includes('/api/thumbnails/')) {
                            target.src = `${apiUrl}/api/thumbnails/${series.id}`;
                          } else {
                            // Final fallback: Show gradient with season number
                            const parent = target.parentElement!;
                            parent.innerHTML = `
                              <div class="w-full h-full bg-gradient-to-br from-red-600 to-red-800 flex flex-col items-center justify-center">
                                <span class="text-4xl font-bold text-white">S${season.season_number}</span>
                                <span class="text-sm font-medium text-white/80 text-center px-2">${series.title}</span>
                              </div>
                            `;
                          }
                        }}
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
                        S{season.season_number}
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-3 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                        <div className="text-white text-xs text-center mb-2">
                          {season.episode_count} Episode{season.episode_count !== 1 ? 's' : ''}
                        </div>
                        {season.episodes && season.episodes.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const firstEpisode = episodes.find(ep => ep.id === season.episodes![0].id);
                              if (firstEpisode) handlePlay(firstEpisode);
                            }}
                            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded text-xs font-medium flex items-center justify-center gap-1"
                          >
                            <Play className="w-3 h-3" />
                            Play
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="text-white font-medium text-sm group-hover:text-red-400 transition-colors duration-300">
                      {season.name}
                    </h3>

                    {season.overview && (
                      <p className="text-white/60 text-xs mt-1 line-clamp-2">
                        {season.overview}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </ScrollReveal>


          {/* Series Details */}
          <ScrollReveal direction="up" delay={0.6}>
            <div className="mt-16">
              <h2 className="text-3xl font-bold text-white mb-8">About {series.title}</h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-4">Series Information</h3>
                  <div className="space-y-3">
                    <div className="flex">
                      <span className="w-32 text-white/60">Type</span>
                      <span className="text-white">TV Series</span>
                    </div>
                    {series.genres && series.genres.length > 0 && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Genres</span>
                        <span className="text-white">{series.genres.map(g => g.name).join(', ')}</span>
                      </div>
                    )}
                    <div className="flex">
                      <span className="w-32 text-white/60">Seasons</span>
                      <span className="text-white">{seasons.length}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 text-white/60">Episodes</span>
                      <span className="text-white">{episodes.length}</span>
                    </div>
                    {series.rating && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Rating</span>
                        <span className="text-white flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400" />
                          {series.rating}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-white mb-4">Production Details</h3>
                  <div className="space-y-3">
                    {series.director && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Creator</span>
                        <span className="text-white">{series.director}</span>
                      </div>
                    )}
                    {series.stars && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Cast</span>
                        <span className="text-white">{series.stars}</span>
                      </div>
                    )}
                    {series.country && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Country</span>
                        <span className="text-white">{series.country}</span>
                      </div>
                    )}
                    {series.language && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Language</span>
                        <span className="text-white">{series.language}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* Video Player Modal */}
      {selectedMedia && (
        <VideoPlayer
          media={selectedMedia}
          isOpen={isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
          startTime={continueWatching?.progress || 0}
          onPlayNext={(nextMedia) => {
            console.log('Playing next episode:', nextMedia.title);
            setSelectedMedia(nextMedia);
            // Keep player open and switch to next episode
          }}
        />
      )}
    </div>
  );
}