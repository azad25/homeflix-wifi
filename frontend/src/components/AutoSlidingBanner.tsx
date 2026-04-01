"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star } from 'lucide-react';

interface AutoSlidingBannerProps {
  movies: any[];
  getBackdropUrl: (movie: any) => string;
  getLogoUrl?: (movie: any) => string | null | undefined;
  onClick: (movie: any) => void;
  className?: string;
  isLarge?: boolean;
  showNewTag?: boolean;
  newTagText?: string;
  logoMinWidthClass?: string;
  logoMaxWidthClass?: string;
  requireCurrentYearForNewTag?: boolean;
  recentMovieIds?: Array<number | string>;
}

export default function AutoSlidingBanner({
  movies,
  getBackdropUrl,
  getLogoUrl,
  onClick,
  className = "",
  isLarge = false,
  showNewTag = false,
  newTagText = 'New',
  logoMinWidthClass,
  logoMaxWidthClass,
  requireCurrentYearForNewTag = false,
  recentMovieIds = [],
}: AutoSlidingBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [intervalTime, setIntervalTime] = useState(4000);

  useEffect(() => {
    // Generate random interval between 3.5s and 6s per instance
    setIntervalTime(Math.floor(Math.random() * 2500) + 3500);
    
    const observer = new IntersectionObserver(
      (entries) => {
        setIsInView(entries[0].isIntersecting);
      },
      { threshold: 0.3 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView && !isHovered) return;
    
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % movies.length);
    }, intervalTime);
    
    return () => clearInterval(interval);
  }, [isInView, isHovered, movies.length, intervalTime]);

  const activeMovie = movies[activeIndex];
  if (!activeMovie) return null;
  const currentYear = new Date().getFullYear();
  const releaseYear = activeMovie.year ||
    ((activeMovie.release_date && !activeMovie.release_date.startsWith('0001')) ? new Date(activeMovie.release_date).getFullYear() :
      (activeMovie.first_air_date && !activeMovie.first_air_date.startsWith('0001')) ? new Date(activeMovie.first_air_date).getFullYear() : null);
  const isReleaseInCurrentYear = !!releaseYear && releaseYear === currentYear;
  const isRecentMovie = recentMovieIds.length === 0 || recentMovieIds.includes(activeMovie.id);
  const shouldShowNewTag = showNewTag && (!requireCurrentYearForNewTag || (isRecentMovie && isReleaseInCurrentYear));

  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 w-full h-full overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.img
          key={activeMovie.id}
          src={getBackdropUrl(activeMovie)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[10000ms] ease-linear scale-100 hover:scale-110"
          alt={activeMovie.title || activeMovie.name || 'Banner'}
        />
      </AnimatePresence>
      
      {/* Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent opacity-90 transition-opacity duration-300" />
      
      {/* Title & Info */}
      <div className="absolute bottom-2 left-0 right-0 p-4 lg:p-5 flex flex-col justify-end z-10 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={`info-${activeMovie.id}`}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {isLarge && getLogoUrl && getLogoUrl(activeMovie) ? (
              <img
                src={getLogoUrl(activeMovie)!}
                alt={activeMovie.title || activeMovie.name || 'Logo'}
                className={`${logoMinWidthClass || 'w-32'} ${logoMaxWidthClass || 'sm:w-48 md:w-56 lg:w-72'} max-h-[70px] object-contain object-left mb-2 drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)]`}
              />
            ) : (
              <h3 className={`text-white font-bold leading-tight drop-shadow-lg ${isLarge ? 'text-xl md:text-3xl lg:text-4xl mb-1.5' : 'text-base md:text-lg lg:text-xl mb-1'} line-clamp-1`}>
                {activeMovie.title || activeMovie.name}
              </h3>
            )}
            
            <div className="flex flex-wrap items-center gap-2 md:gap-3 text-white/80 text-[10px] md:text-xs font-medium">
              {(() => {
                const year = activeMovie.year || 
                  ((activeMovie.release_date && !activeMovie.release_date.startsWith('0001')) ? new Date(activeMovie.release_date).getFullYear() : 
                   (activeMovie.first_air_date && !activeMovie.first_air_date.startsWith('0001')) ? new Date(activeMovie.first_air_date).getFullYear() : null);
                return year && year > 1000 ? <span>{year}</span> : null;
              })()}
              {activeMovie.vote_average > 0 && (
                <span className="flex items-center gap-1 text-yellow-500 font-bold">
                  <Star className="w-3 h-3 md:w-3.5 md:h-3.5 fill-current" />
                  {activeMovie.vote_average.toFixed(1)}
                </span>
              )}
              {activeMovie.quality && (
                <span className="bg-red-600/80 backdrop-blur-md rounded px-1.5 py-0.5 font-bold text-[9px] text-white">
                  {activeMovie.quality}
                </span>
              )}
              {((activeMovie.genres && activeMovie.genres.length > 0) || shouldShowNewTag) && (
                <div className="hidden sm:flex items-center gap-1.5">
                  {activeMovie.genres && activeMovie.genres.length > 0 && (
                    <>
                      <span className="text-white/40 mr-1">•</span>
                      {activeMovie.genres.slice(0, isLarge ? 4 : 2).map((genre: any, i: number) => (
                        <span key={i} className="text-[9px] md:text-[10px] uppercase font-extrabold tracking-wider text-white/60">
                          {typeof genre === 'string' ? genre : genre?.name}
                          {i < Math.min(activeMovie.genres.length, isLarge ? 4 : 2) - 1 && <span className="ml-1.5 text-red-500/50">•</span>}
                        </span>
                      ))}
                    </>
                  )}
                  {shouldShowNewTag && (
                    <span className="px-1.5 py-0.5 rounded bg-red-600/90 text-white text-[9px] md:text-[10px] font-bold uppercase tracking-wider border border-red-400/70">
                      {newTagText}
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slide Indicators */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 z-30 pointer-events-auto">
        {movies.map((_, idx) => (
          <button 
            key={idx} 
            onClick={(e) => {
              e.stopPropagation();
              setActiveIndex(idx);
            }}
            className={`h-1.5 rounded-full transition-all duration-500 ${idx === activeIndex ? 'w-4 bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'w-1.5 bg-white/30 hover:bg-white/50'}`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
      
      {/* Invisible Interactive Layer covering everything except dots */}
      <div 
        className="absolute inset-0 z-20"
        onClick={(e) => {
          e.stopPropagation();
          onClick(activeMovie);
        }}
      />
    </div>
  );
}
