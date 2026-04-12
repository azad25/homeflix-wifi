"use client";

import React, { useState, useEffect } from 'react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { Film, Star, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { cachedFetch } from '@/lib/apiCache';
import { useRouter } from 'next/navigation';
import AutoSlidingBanner from './AutoSlidingBanner';

interface RecommendationSectionProps {
  currentMedia: Media;
  className?: string;
  onPlay?: (media: Media) => void;
  onInfo?: (media: Media) => void;
}

export default function RecommendationSection({ currentMedia, className = '', onPlay, onInfo }: RecommendationSectionProps) {
  const [recommendations, setRecommendations] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        const apiUrl = getApiUrl();
        
        // Try the dedicated recommendations endpoint first
        try {
          const recData = await cachedFetch(`${apiUrl}/api/recommendations/mixed?limit=30`);
          if (recData && Array.isArray(recData) && recData.length > 0 && isMounted) {
            const filtered = recData.filter(m => m.id !== currentMedia.id);
            if (filtered.length > 0) {
              setRecommendations(filtered.slice(0, 14)); // 2 rows of 7 pattern
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn("Failed primary recommendation endpoint", e);
        }

        // Fallback to general media cleanly avoiding bloated row assignments
        const fallbackData = await cachedFetch(`${apiUrl}/api/media?limit=100`);
        if (fallbackData && Array.isArray(fallbackData) && isMounted) {
           const filtered = fallbackData.filter(m => m.id !== currentMedia.id);
           // Shuffle lightly
           const shuffled = filtered.sort(() => 0.5 - Math.random());
           setRecommendations(shuffled.slice(0, 14));
        }

      } catch (err) {
        console.error("Failed to load recommendations:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRecommendations();

    return () => { isMounted = false; };
  }, [currentMedia.id]);

  const resolveLocalAssetUrl = (path: string | undefined | null) => {
    if (!path) return null;
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const apiUrl = getApiUrl();
    if (path.includes('/api/')) return path.startsWith('/') ? `${apiUrl}${path}` : `${apiUrl}/${path}`;
    
    if (path.startsWith('assets/')) return `${apiUrl}/api/admin/assets/${path.replace('assets/', '')}`;
    if (path.startsWith('backdrops/')) return `${apiUrl}/api/static/backdrops/${path.replace('backdrops/', '')}`;
    if (path.startsWith('posters/')) return `${apiUrl}/api/static/posters/${path.replace('posters/', '')}`;
    if (path.startsWith('thumbnails/')) return `${apiUrl}/api/static/thumbnails/${path.replace('thumbnails/', '')}`;
    if (path.startsWith('logos/')) return `${apiUrl}/api/logos/${path.replace('logos/', '')}`;
    
    return path.startsWith('/') ? `${apiUrl}${path}` : `${apiUrl}/${path}`;
  };

  const getPosterUrl = (movie: Media) => {
    try {
      if ((movie as any)?.poster_url) return (movie as any).poster_url;
      const posterPathRaw = (movie as any)?.poster_path;
      if (posterPathRaw && posterPathRaw.trim() !== '') {
          const resolved = resolveLocalAssetUrl(posterPathRaw);
          if (resolved) return resolved;
      }
      
      const apiUrl = getApiUrl();
      if (!apiUrl || !movie?.id) return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE4Ny4yNzkgMjAwIDIxOCAxNjkuMjc5IDIxOCAxMzJDMjE4IDk0LjcyMDggMTg3LjI3OSA2NCAxNTAgNjRDMTEyLjcyMSA2NCA4MiA5NC43MjA4IDgyIDEzMkM4MiAxNjkuMjc5IDExMi43MjEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik04MiAyNzZDODIgMjM4LjY4IDExMi42OCAyODggMTUwIDIwOEgxNTBDMTg3LjMyIDIwOCAyMTggMjM4LjY4IDIxOCAyNzZWMzUwSDgyVjI3NloiIGZpbGw9IiM2QjcyODgiLz4KPHN2Zz4K';
      if (movie.type === 'tv' || movie.type === 'series' || movie.type === 'episode') {
         return `${apiUrl}/api/series/${movie.id}/poster`;
      }
      return `${apiUrl}/api/posters/${movie.id}`;
    } catch {
      return '';
    }
  };

  const getBackdropUrl = (movie: Media) => {
    try {
      if ((movie as any)?.banner_url || (movie as any)?.banner_path) {
         const bannerRaw = (movie as any).banner_url || (movie as any).banner_path;
         const resolved = resolveLocalAssetUrl(bannerRaw);
         if (resolved) return resolved;
      }
      if ((movie as any)?.backdrop_url || (movie as any)?.backdrop_path) {
         const backdropRaw = (movie as any).backdrop_url || (movie as any).backdrop_path;
         const resolved = resolveLocalAssetUrl(backdropRaw);
         if (resolved) return resolved;
      }
      
      const tmdbUrl = (movie as any)?.tmdb_backdrop_url;
      if (tmdbUrl) {
         return tmdbUrl.startsWith('/') && !tmdbUrl.startsWith('//') ? `https://image.tmdb.org/t/p/w1280${tmdbUrl}` : tmdbUrl;
      }
      
      const apiUrl = getApiUrl();
      if (!apiUrl || !movie?.id) return getPosterUrl(movie);
      return `${apiUrl}/api/thumbnails/${movie.id}`;
    } catch {
      return getPosterUrl(movie);
    }
  };

  const cleanTitle = (title: string | undefined | null) => {
     if (!title) return 'Unknown Title';
     return title.replace(/\[.*?\]|\(.*?\)/g, '').trim() || title;
  };

  const formatRuntime = (minutes: number) => {
    if (!minutes || minutes <= 0) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return (
      <div className={`py-12 flex justify-center ${className}`}>
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        <h2 className="text-2xl font-black tracking-tight text-white mb-6 flex items-center gap-2">
          <Film className="w-6 h-6 text-red-500" />
          You Might Also Like
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 lg:gap-5 auto-rows-[140px] md:auto-rows-[180px] lg:auto-rows-[200px] grid-flow-row-dense">
          {recommendations.map((movie, index) => {
            if (!movie?.id) return null;

            // Pattern repeating every 7 items for beautiful masonry layout
            const pattern = index % 7;
            let spanClass = "col-span-1 row-span-2 aspect-[2/3]"; // Default fallback poster
            let imageSrc = getPosterUrl(movie);
            let isBackdrop = false;

            if (pattern === 0) {
              // Large Featured Backdrop
              spanClass = "col-span-2 md:col-span-4 lg:col-span-4 row-span-2";
              imageSrc = getBackdropUrl(movie);
              isBackdrop = true;
            } else if (pattern === 1 || pattern === 2) {
              // Standard Posters (row 1 right side)
              spanClass = "col-span-1 md:col-span-2 lg:col-span-1 row-span-2";
              imageSrc = getPosterUrl(movie);
            } else if (pattern === 3 || pattern === 4) {
              // Small Backdrops
              spanClass = "col-span-2 md:col-span-2 lg:col-span-2 row-span-1";
              imageSrc = getBackdropUrl(movie);
              isBackdrop = true;
            } else {
              // Small regular posters
              spanClass = "col-span-1 md:col-span-1 lg:col-span-1 row-span-2 aspect-[2/3]";
              imageSrc = getPosterUrl(movie);
              isBackdrop = false;
            }

            const isLarge = pattern === 0;
            const bannerMovies = isBackdrop ? [
              movie,
              recommendations[(index + 3) % recommendations.length],
              recommendations[(index + 7) % recommendations.length]
            ].filter(Boolean) : [];

            return (
              <motion.div
                key={movie.id}
                className={`group cursor-pointer relative rounded-xl overflow-hidden shadow-2xl border border-white/5 hover:border-white/20 transition-all ${spanClass}`}
                whileHover={{ scale: 1.02, zIndex: 10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                onClick={() => {
                   if (onInfo) {
                     onInfo(movie);
                     return;
                   }
                   if (movie.type === 'tv' || movie.type === 'series') router.push(`/tv-series/${movie.id}`);
                   else if ((movie as any).tmdb_id && !(movie as any).file_path) router.push(`/tmdb-movie/${(movie as any).tmdb_id}`);
                   else router.push(`/movie/${movie.id}`);
                }}
              >
                {isBackdrop ? (
                   <AutoSlidingBanner
                     movies={bannerMovies}
                     getBackdropUrl={getBackdropUrl}
                     getLogoUrl={(m: any) => resolveLocalAssetUrl(m.logo_path || m.logo)}
                     onClick={(m) => {
                       if (onInfo) {
                         onInfo(m);
                         return;
                       }
                       if (m.type === 'tv' || m.type === 'series') router.push(`/tv-series/${m.id}`);
                       else if ((m as any).tmdb_id && !(m as any).file_path) router.push(`/tmdb-movie/${(m as any).tmdb_id}`);
                       else router.push(`/movie/${m.id}`);
                     }}
                     isLarge={isLarge}
                   />
                 ) : (
                   <>
                     <img
                       src={imageSrc}
                       alt={cleanTitle(movie.title || (movie as any).name)}
                       className="w-full h-full object-cover transition-transform duration-700 ease-out"
                       loading="lazy"
                       onError={(e) => {
                         const target = e.target as HTMLImageElement;
                         target.onerror = null;
                         target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE4Ny4yNzkgMjAwIDIxOCAxNjkuMjc5IDIxOCAxMzJDMjE4IDk0LjcyMDggMTg3LjI3OSA2NCAxNTAgNjRDMTEyLjcyMSA2NCA4MiA5NC43MjA4IDgyIDEzMkM4MiAxNjkuMjc5IDExMi43MjEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik04MiAyNzZDODIgMjM4LjY4IDExMi42OCAyODggMTUwIDIwOEgxNTBDMTg3LjMyIDIwOCAyMTggMjM4LjY4IDIxOCAyNzZWMzUwSDgyVjI3NloiIGZpbGw9IiM2QjcyODgiLz4KPHN2Zz4K';
                       }}
                     />
     
                     {/* Dark Vignette Overlay */}
                     <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80 transition-opacity duration-300" />
     
                     {/* Top Quick Info */}
                     <div className="absolute top-3 right-3 flex items-center gap-2">
                       {movie.rating && movie.rating > 0 && (
                         <div className="bg-black/60 backdrop-blur-md rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow-lg">
                           <Star className="w-3.5 h-3.5 text-yellow-400 fill-current" />
                           <span className="text-xs font-bold text-white">
                             {movie.rating.toFixed(1)}
                           </span>
                         </div>
                       )}
                       {movie.quality && (
                         <div className="bg-red-600/80 backdrop-blur-md rounded px-1.5 py-0.5 flex items-center shadow-lg">
                           <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                             {movie.quality}
                           </span>
                         </div>
                       )}
                     </div>
     
                     {/* Bottom Content Info */}
                     <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                       <h3 className="font-bold text-white drop-shadow-xl text-sm md:text-base mb-1 line-clamp-1">
                         {cleanTitle(movie.title || (movie as any).name)}
                       </h3>
                       
                       <div className="flex items-center gap-3 text-white/80 text-xs font-medium">
                         {movie.year && (
                           <span className="bg-white/20 backdrop-blur-md px-1.5 py-0.5 rounded shadow-sm">
                             {movie.year}
                           </span>
                         )}
                         {movie.duration && movie.duration > 0 && (
                           <div className="flex items-center gap-1 drop-shadow-md">
                             <Clock className="w-3 h-3 text-red-400" />
                             {formatRuntime(Math.floor(movie.duration / 60))}
                           </div>
                         )}
                       </div>
                     </div>
                   </>
                 )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
