"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Play, Plus, Check, Share, Download, Info, Star, Clock, Calendar, Globe, Users, Award, Film, Tv, User, Mic, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from 'next/image';
import { Media } from '../../../types/media';
import VideoPlayer from '../../../components/VideoPlayer';
import { getApiUrl } from '../../../lib/api';
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
  const [similarMedia, setSimilarMedia] = useState<Media[]>([]);
  const [isInMyList, setIsInMyList] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [lastWatched, setLastWatched] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchMedia();
      fetchSimilarMedia();
      checkMyList();
      loadPlaybackProgress();
    }
  }, [params.id]);

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
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/media/${params.id}/similar`);
      const data = await response.json();
      setSimilarMedia(data);
    } catch (error) {
      console.error('Error fetching similar media:', error);
    }
  };

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

  const renderMediaContent = (media: Media) => (
    <div className="min-h-screen bg-black text-white">
      <GradientBackground variant="cosmic" animate={true} className="fixed inset-0 -z-10" />
      
      {/* Hero Section */}
      <div className="relative h-screen overflow-hidden">
        {/* Background Image with Parallax */}
        <ParallaxSection speed={0.5}>
          <div className="absolute inset-0">
            <Image
              src={getBackgroundImageUrl(media)}
              alt={media.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        </ParallaxSection>

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-10" />

        {/* Navigation */}
        <div className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-center">
          <MagneticButton
            onClick={() => router.back()}
            className="bg-black/50 backdrop-blur-md text-white p-3 rounded-full hover:bg-black/70 transition-all duration-300"
          >
            <ArrowLeft className="w-6 h-6" />
          </MagneticButton>
        </div>

        {/* Hero Content */}
        <div className="absolute inset-0 flex items-center z-20">
          <ParticleField count={50} className="absolute inset-0 opacity-30" />
          
          <div className="container mx-auto px-6 md:px-12 lg:px-16 relative z-10">
            <div className="max-w-2xl">
              <ScrollReveal direction="up" delay={0.1}>
                <DynamicTitle media={media} className="mb-6" />
              </ScrollReveal>

              {media.tagline && (
                <ScrollReveal direction="up" delay={0.2}>
                  <motion.p className="text-xl md:text-2xl text-white/90 italic mb-6 drop-shadow-lg">
                    &ldquo;{media.tagline}&rdquo;
                  </motion.p>
                </ScrollReveal>
              )}

              <ScrollReveal direction="up" delay={0.3}>
                <div className="flex items-center gap-4 text-white/90 mb-6 flex-wrap">
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
                </div>

                <div className="flex flex-wrap gap-4 mb-8">
                  <MagneticButton
                    onClick={handlePlay}
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg text-lg font-semibold flex items-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    {playbackProgress > 0 ? 'Continue Watching' : 'Play'}
                    {playbackProgress > 0 && (
                      <span className="text-sm font-normal opacity-80">
                        {formatProgressPercentage(playbackProgress)}% watched
                      </span>
                    )}
                  </MagneticButton>

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
                </div>
              </ScrollReveal>

              <ScrollReveal direction="up" delay={0.4}>
                <div className="max-w-2xl">
                  <p className="text-white/90 mb-4">
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
              </ScrollReveal>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          <motion.div
            initial={{ y: 0 }}
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex flex-col items-center text-white/70"
          >
            <span className="text-sm mb-1">Scroll for more</span>
            <ChevronDown className="w-6 h-6" />
          </motion.div>
        </div>
      </div>

      {/* Details Section */}
      <div className="relative z-10 bg-black pt-16 pb-24">
        <div className="container mx-auto px-6 md:px-12 lg:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              {/* Media Info */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-6">About {media.title}</h2>
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
                      <h3 className="text-lg font-semibold text-white mb-3">Stats</h3>
                      <div className="space-y-2">
                        {media.rating && (
                          <div className="flex">
                            <span className="w-32 text-white/60">Rating</span>
                            <span className="text-white flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-400" />
                              {media.rating}
                            </span>
                          </div>
                        )}
                        <div className="flex">
                          <span className="w-32 text-white/60">Views</span>
                          <span className="text-white">{(media.view_count || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex">
                          <span className="w-32 text-white/60">Added</span>
                          <span className="text-white">{new Date().getFullYear()}</span>
                        </div>
                      </div>
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
              media={similarMedia}
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
