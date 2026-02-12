"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ThumbsUp, Calendar, Play, Info, Volume2, VolumeX, Flame, Zap, Crown, Heart, Sparkles, Award, TrendingUp, Clock, Eye, Gift, Rocket, Target, Shield, Diamond, Plus, Check } from "lucide-react";
import { getApiUrl } from '@/lib/api';
import { Media } from "@/types/media";
import VideoPlayerOverlay from './VideoPlayerOverlay';
import { navigateToMedia } from '@/lib/mediaNavigation';
import { useNavigate } from '@/hooks/useNavigate';
import { useRecommendationScore } from '@/lib/swr-api';
import { useMyList } from '@/hooks/useMyList';
import MyListTooltip from '@/components/ui/MyListTooltip';

export type HeroMode = "preview" | "trailer" | "mixed";

interface HeroVideoWidgetProps {
  media: Media[];
  mode: HeroMode;
  autoPlay?: boolean;
  slideDurationMs?: number;
  className?: string;
  config?: any;
  isMuted?: boolean;
}

const getGenreTheme = (genre: string = "") => {
  const g = genre.toLowerCase();
  if (g.includes("action")) return { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", fill: "fill-orange-400", stroke: "stroke-orange-400" };
  if (g.includes("sci") || g.includes("science")) return { text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", fill: "fill-cyan-400", stroke: "stroke-cyan-400" };
  if (g.includes("drama")) return { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", fill: "fill-purple-400", stroke: "stroke-purple-400" };
  if (g.includes("horror")) return { text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", fill: "fill-red-500", stroke: "stroke-red-500" };
  if (g.includes("comedy")) return { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", fill: "fill-yellow-400", stroke: "stroke-yellow-400" };
  if (g.includes("romance")) return { text: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20", fill: "fill-pink-400", stroke: "stroke-pink-400" };
  if (g.includes("thriller")) return { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", fill: "fill-emerald-400", stroke: "stroke-emerald-400" };
  if (g.includes("fantasy")) return { text: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", fill: "fill-indigo-400", stroke: "stroke-indigo-400" };
  if (g.includes("animation")) return { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", fill: "fill-blue-400", stroke: "stroke-blue-400" };
  return { text: "text-white/90", bg: "bg-white/10", border: "border-white/20", fill: "fill-white", stroke: "stroke-white" };
};

export default function HeroVideoWidget({
  media,
  mode,
  autoPlay = true,
  slideDurationMs = 8000,
  className = "",
  config = {},
  isMuted: initialMuted = true,
}: HeroVideoWidgetProps) {
  const apiUrl = getApiUrl();
  const navigate = useNavigate();
  const { isInMyList, toggleMyList, collections, addToCollection, fetchCollections } = useMyList();

  // Icon mapping for tags
  const getTagIcon = (iconName: string) => {
    const iconMap: { [key: string]: React.ComponentType<any> } = {
      'Star': Star,
      'Fire': Flame,
      'Lightning': Zap,
      'Crown': Crown,
      'Heart': Heart,
      'Sparkles': Sparkles,
      'Award': Award,
      'Trending': TrendingUp,
      'Clock': Clock,
      'Calendar': Calendar,
      'Play': Play,
      'Eye': Eye,
      'Thumbs Up': ThumbsUp,
      'Gift': Gift,
      'Rocket': Rocket,
      'Target': Target,
      'Shield': Shield,
      'Diamond': Diamond
    };
    return iconMap[iconName] || Sparkles; // Default to Sparkles if icon not found
  };

  const TagIcon = getTagIcon(config?.tagIcon || 'Sparkles');
  const [index, setIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [imageLoaded, setImageLoaded] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ytReady, setYtReady] = useState(false);
  const [ytVideoReady, setYtVideoReady] = useState(false);
  const playerRef = useRef<any>(null);
  const [logoUrls, setLogoUrls] = useState<Record<number, string>>({});
  const logoUrlsRef = useRef<Record<number, string>>({});
  const [fetchedKeys, setFetchedKeys] = useState<Record<number, string>>({});
  const advanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const trailerLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const TRAILER_LOAD_TIMEOUT_MS = 8000;
  const VIDEO_LOAD_TIMEOUT_FIRST_MS = 1000; // Fast first slide
  const VIDEO_LOAD_TIMEOUT_MS = 5000; // Standard timeout
  const isMutedRef = useRef(isMuted);

  const [progress, setProgress] = useState(0);
  const progressAnimationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Video player overlay state
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [selectedMediaForPlayback, setSelectedMediaForPlayback] = useState<Media | null>(null);

  const items = useMemo(() => (Array.isArray(media) ? media.slice(0, Math.max(1, media.length)) : []), [media]);
  const current = items[index] || null;
  const startOffsetSeconds = 10;
  const endOffsetSeconds = 10;

  useEffect(() => {
    logoUrlsRef.current = logoUrls;
  }, [logoUrls]);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Sync mute ref
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Sync with prop change
  useEffect(() => {
    setIsMuted(initialMuted);
  }, [initialMuted]);

  const advanceTriggeredRef = useRef(false);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Preloading refs
  const preloadedVideos = useRef<Map<number, HTMLVideoElement>>(new Map());
  const preloadedUrls = useRef<Map<number, string>>(new Map());

  // Helper Functions
  const getBackdropUrl = useCallback(
    (m: Media) => m.tmdb_backdrop_url || m.banner_path || m.backdrop_path || (m.thumbnail_path ? `${apiUrl}${m.thumbnail_path}` : `${apiUrl}/api/thumbnails/${m.id}`),
    [apiUrl]
  );

  const getLogoUrl = useCallback((m: Media) => {
    // Check fetched logos first (from TMDB API)
    if (m.tmdb_id && logoUrls[m.tmdb_id]) {
      return logoUrls[m.tmdb_id];
    }
    
    // Handle local content logos - simple approach like RecentlyWatchedWidget
    if (m.logo_path) {
      // If it's a full URL, use it directly
      if (m.logo_path.startsWith("http://") || m.logo_path.startsWith("https://")) {
        return m.logo_path;
      }
      
      // If it's a TMDB path (starts with /), construct TMDB URL
      if (m.logo_path.startsWith("/") && !m.logo_path.startsWith("/api/")) {
        return `https://image.tmdb.org/t/p/w500${m.logo_path}`;
      }
      
      // Handle API paths
      if (m.logo_path.startsWith("/api/")) {
        return `${apiUrl}${m.logo_path}`;
      }
      
      // For simple filenames or relative paths
      const filename = m.logo_path.includes('/') ? m.logo_path.split('/').pop() : m.logo_path;
      return `${apiUrl}/api/logos/${filename}`;
    }
    
    return "";
  }, [apiUrl, logoUrls]);

  const extractYouTubeKey = useCallback((url: string): string | null => {
    if (!url) return null;
    const cleanUrl = url.trim();
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match) return match[1];
    }
    if (cleanUrl.match(/^([a-zA-Z0-9_-]{11})$/)) return cleanUrl;
    return null;
  }, []);

  const getTrailerKey = useCallback((m: Media | null) => {
    if (!m) return null;

    // Check TMDB trailer URL first
    if (m.tmdb_trailer_url) {
      const k = extractYouTubeKey(m.tmdb_trailer_url);
      if (k) return k;
    }

    // Check local trailer path (might be a YouTube URL)
    if (m.trailer_path) {
      const k = extractYouTubeKey(m.trailer_path);
      if (k) return k;
    }

    // For TV series, check series-level trailer
    if ((m as any).series?.tmdb_trailer_url) {
      const k = extractYouTubeKey((m as any).series.tmdb_trailer_url);
      if (k) return k;
    }

    // Check fetched keys cache
    if (m.tmdb_id && fetchedKeys[m.tmdb_id]) return fetchedKeys[m.tmdb_id];

    return null;
  }, [extractYouTubeKey, fetchedKeys]);

  const getPosterUrl = useCallback((m: Media) => {
    if (m.poster_path) return `${apiUrl}/api/posters/${m.id}`;
    if (m.tmdb_poster_url) return m.tmdb_poster_url;
    if ((m.type === 'tv' || m.type === 'series' || m.type === 'episode') && (m.backdrop_path || m.tmdb_backdrop_url)) {
      return getBackdropUrl(m);
    }
    if (m.thumbnail_path) return `${apiUrl}${m.thumbnail_path}`;
    return `${apiUrl}/api/posters/${m.id}`;
  }, [apiUrl, getBackdropUrl]);

  const getYear = useCallback((m: Media) => {
    // Try year field first
    if (m.year && m.year > 1900) return m.year;
    
    // Fallback to date fields
    const date = m.release_date || m.first_air_date;
    if (date) {
      const year = new Date(date).getFullYear();
      if (!Number.isNaN(year) && year > 1900) return year;
    }
    
    return null;
  }, []);

  const getDisplayRating = useCallback((m: Media) => {
    if (typeof m.rating === "number" && m.rating > 0) {
      return Math.min(10, Math.max(0, Number(m.rating.toFixed(1))));
    }
    if (typeof m.vote_count === "number" && m.vote_count > 0 && typeof m.popularity === "number") {
      const derived = Math.min(10, m.popularity / 10);
      return Number(derived.toFixed(1));
    }
    return null;
  }, []);

  // Mock score fallback - improved for local content
  const calculateMockScore = useCallback((m: Media) => {
    const rating = typeof m.rating === "number" && m.rating > 0 ? m.rating : 0;
    const popularity = typeof m.popularity === "number" ? Math.min(100, m.popularity) : 0;
    const voteCount = typeof m.vote_count === "number" ? Math.min(200, m.vote_count) : 0;
    const viewCount = typeof (m as any).view_count === "number" ? Math.min(100, (m as any).view_count) : 0;

    // Enhanced calculation for local content
    let base = rating * 8; // Rating is most important
    base += popularity * 0.15;
    base += (voteCount / 10);
    base += (viewCount * 0.5); // Local view count bonus

    // Year bonus for newer content
    if (m.year && m.year > 2015) {
      base += (m.year - 2015) * 0.5;
    }

    // Quality bonus
    if (m.quality && (m.quality.includes('4K') || m.quality.includes('2160'))) {
      base += 3;
    }

    const score = base || 70; // Higher default for local content
    return Math.max(65, Math.min(98, Math.round(score)));
  }, []);

  // Fetch real recommendation score
  const { data: scoreData } = useRecommendationScore(current?.id || 0);


  const isTrailer = useCallback((m: Media) => {
    if (mode === "preview") return false;
    if (mode === "trailer") {
      // For trailer mode, always try to show trailer if available
      return !!getTrailerKey(m);
    }
    if (mode === "mixed") {
      // For mixed mode, prefer trailer if available, otherwise fall back to preview
      return !!getTrailerKey(m);
    }
    return false;
  }, [mode, getTrailerKey]);

  const hasLocalFile = useCallback((m: Media) => {
    const rawSource = (m as any).source_type;
    // If explicitly TMDB, hide play button
    // if (rawSource === 'tmdb') return false;

    // // If explicitly Local, show play button
    // if (rawSource === 'local') return true;

    // If it has a file path, it's local
    // if (m.file_path || (m as any).path) return true;

    // // If it has a numeric ID and NO tmdb_id, it is local
    // if (typeof m.id == 'number' && !m.tmdb_id) return true;

    // // If it has a tmdb_id and NO file_path, assume it's TMDB-only (hide)
    //if (!m.file_path) return false;

    // Default: Show play button (err on side of visible)
    return true;
  }, []);

  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (progressAnimationFrameRef.current) {
      cancelAnimationFrame(progressAnimationFrameRef.current);
      progressAnimationFrameRef.current = null;
    }
  }, []);

  const clearAdvanceTimeout = useCallback(() => {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
  }, []);

  const advanceSlide = useCallback(() => {
    if (advanceTriggeredRef.current) return;
    advanceTriggeredRef.current = true;

    // Immediate cleanup
    clearProgressInterval();

    const currentItems = itemsRef.current;
    if (!currentItems || currentItems.length === 0) {
      advanceTriggeredRef.current = false;
      return;
    }

    if (currentItems.length === 1) {
      // Loop single item: reset progress and replay
      setProgress(0);

      // Replay Native Video
      if (videoRef.current) {
        try {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => { });
        } catch { }
      }

      // Replay YouTube
      if (playerRef.current && typeof playerRef.current.seekTo === "function" && typeof playerRef.current.playVideo === "function") {
        try {
          playerRef.current.seekTo(10, true);
          playerRef.current.playVideo();
        } catch { }
      }

      setTimeout(() => {
        advanceTriggeredRef.current = false;
      }, 500);
      return;
    }

    if (playerRef.current && typeof playerRef.current.stopVideo === "function") {
      try { playerRef.current.stopVideo(); } catch { }
    }
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch { }
    }

    setIndex((prev) => {
      const length = itemsRef.current?.length || 0;
      if (length === 0) return prev;
      return (prev + 1) % length;
    });

    // Reset states for next slide
    setProgress(0);
    setImageLoaded(false);
    setYtVideoReady(false);

    // Unlock after transition duration
    setTimeout(() => {
      advanceTriggeredRef.current = false;
    }, 1000);
  }, [clearProgressInterval]);

  const goToIndex = useCallback((targetIndex: number) => {
    if (targetIndex === index || targetIndex < 0 || targetIndex >= itemsRef.current.length) return;
    clearProgressInterval();
    advanceTriggeredRef.current = false;
    setProgress(0);
    if (playerRef.current && typeof playerRef.current.stopVideo === "function") try { playerRef.current.stopVideo(); } catch { }
    if (videoRef.current) try { videoRef.current.pause(); } catch { }
    setImageLoaded(false);
    setIndex(targetIndex);
  }, [index, clearProgressInterval]);

  // Load Logos - batch fetched with concurrency limit of 3
  useEffect(() => {
    if (!items.length) return;
    const pending = items.filter(item => item.tmdb_id && !logoUrlsRef.current[item.tmdb_id]);
    if (!pending.length) return;
    const controller = new AbortController();

    // Limit concurrent requests to reduce network load
    const loadLogosInBatches = async () => {
      const BATCH_SIZE = 3;
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async item => {
          try {
            const type = (item.type === 'tv' || item.type === 'series') ? 'tv' : 'movie';
            const res = await fetch(`${apiUrl}/api/tmdb/${type}/${item.tmdb_id}/images`, { signal: controller.signal });
            if (!res.ok) return;
            const data = await res.json();
            const logos = data?.logos || [];
            if (!logos.length) return;
            const preferred = logos.find((l: any) => l.iso_639_1 === "en") || logos[0];
            if (preferred?.file_path) {
              const url = `https://image.tmdb.org/t/p/w500${preferred.file_path}`;
              setLogoUrls(prev => {
                if (item.tmdb_id && prev[item.tmdb_id] === url) return prev;
                const next = item.tmdb_id ? { ...prev, [item.tmdb_id]: url } : prev;
                logoUrlsRef.current = next;
                return next;
              });
            }
          } catch { }
        }));
      }
    };
    loadLogosInBatches();
    return () => controller.abort();
  }, [items, apiUrl]);

  // Preloading Logic
  const getPreviewClipUrl = useCallback((m: Media) => {
    return `${apiUrl}/api/preview-clips/${m.id}?quality=high&format=mp4&cache=true`;
  }, [apiUrl]);

  const preloadVideo = useCallback((m: Media) => {
    if (!m.id || preloadedVideos.current.has(m.id)) return;

    // Only preload native previews (files), not external trailers for now (unless we want to preload poster images for them)
    if (!m.file_path && !m.preview_path) return;

    const url = getPreviewClipUrl(m);
    preloadedUrls.current.set(m.id, url);

    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    // Use cache=true to leverage browser caching
    video.src = url;

    // Start loading
    video.load();

    preloadedVideos.current.set(m.id, video);
    // console.log(`🎬 Preloading video for: ${m.title}`);
  }, [getPreviewClipUrl]);

  // Preload only current video (reduced from 3 to 1 to save resources)
  useEffect(() => {
    if (items.length === 0) return;

    // Only preload current item to reduce memory/bandwidth usage
    if (items[index]) preloadVideo(items[index]);
  }, [index, items, preloadVideo]);

  // Cleanup preloaded videos on unmount
  useEffect(() => {
    return () => {
      preloadedVideos.current.forEach(video => {
        video.pause();
        video.src = "";
        video.load();
      });
      preloadedVideos.current.clear();
      preloadedUrls.current.clear();
    };
  }, []);

  // Load Missing Trailers
  useEffect(() => {
    const pending = items.filter(item => {
      if (item.tmdb_trailer_url && extractYouTubeKey(item.tmdb_trailer_url)) return false;
      if (!item.tmdb_id) return false;
      if (fetchedKeys[item.tmdb_id]) return false;
      return true;
    });
    if (!pending.length) return;
    const controller = new AbortController();
    const loadVideos = async () => {
      await Promise.all(pending.map(async item => {
        try {
          if (!item.tmdb_id) return;
          const type = (item.type === 'tv' || item.type === 'series') ? 'tv' : 'movie';
          const res = await fetch(`${apiUrl}/api/tmdb/${type}/${item.tmdb_id}/videos`, { signal: controller.signal });
          if (!res.ok) return;
          const data = await res.json();
          const results = data.results || [];
          const trailer = results.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer') ||
            results.find((v: any) => v.site === 'YouTube');
          if (trailer?.key) {
            setFetchedKeys(prev => ({ ...prev, [item.tmdb_id!]: trailer.key }));
          }
        } catch { }
      }));
    }
    loadVideos();
    return () => controller.abort();
  }, [items, apiUrl, fetchedKeys, extractYouTubeKey]);

  // Load YouTube API
  useEffect(() => {
    if (mode === "trailer" || mode === "mixed") {
      if ((window as any).YT && (window as any).YT.Player) {
        setYtReady(true);
        return;
      }
      const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
      const prev = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        try { prev && prev(); } catch { }
        setYtReady(true);
      };
      if (!existing) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      const check = setInterval(() => {
        if ((window as any).YT && (window as any).YT.Player) {
          setYtReady(true);
          clearInterval(check);
        }
      }, 100);
      return () => { clearInterval(check); };
    } else {
      setYtReady(true);
    }
  }, [mode]);

  const startDefaultProgress = useCallback(() => {
    if (progressAnimationFrameRef.current) cancelAnimationFrame(progressAnimationFrameRef.current);
    startTimeRef.current = Date.now();
    const frame = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min(100, (elapsed / slideDurationMs) * 100);
      setProgress(p);
      if (p < 100 && !advanceTriggeredRef.current) {
        progressAnimationFrameRef.current = requestAnimationFrame(frame);
      }
    };
    progressAnimationFrameRef.current = requestAnimationFrame(frame);
  }, [slideDurationMs]);

  // Autoplay Logic
  useEffect(() => {
    if (!autoPlay || !current) return;

    // Clear any existing fallback timers
    if (timerRef.current) clearTimeout(timerRef.current);

    // Fallback safety timer: guarantees slide advances if video fails/stalls
    // Duration: expected duration + 5s buffer, or default 15s if unknown
    const safetyDuration = slideDurationMs + 8000;

    timerRef.current = setTimeout(() => {
      if (!advanceTriggeredRef.current) {
        console.log('HeroVideoWidget: Safety timeout triggered, advancing');
        advanceSlide();
      }
    }, safetyDuration);

    startDefaultProgress();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressAnimationFrameRef.current) cancelAnimationFrame(progressAnimationFrameRef.current);
    };
  }, [autoPlay, current, slideDurationMs, advanceSlide, startDefaultProgress]);

  // Init YouTube Player
  useEffect(() => {
    if (!current || !ytReady || !isTrailer(current)) return;
    clearProgressInterval();
    clearAdvanceTimeout();
    setProgress(0);
    advanceTriggeredRef.current = false;
    setYtVideoReady(false);

    const key = getTrailerKey(current);
    const containerId = `yt-player-hero-${current.id}`;

    const checkEl = setInterval(() => {
      const el = document.getElementById(containerId);
      if (el) {
        clearInterval(checkEl);
        initPlayer(el);
      }
    }, 100);
    const timeout = setTimeout(() => clearInterval(checkEl), 3000);

    const initPlayer = (el: HTMLElement) => {
      if (!key) return;
      try {
        if (playerRef.current) { try { playerRef.current.destroy(); } catch { } playerRef.current = null; }
        const YTGlobal = (window as any).YT;
        const PlayerState = YTGlobal?.PlayerState;
        playerRef.current = new YTGlobal.Player(containerId, {
          videoId: key,
          playerVars: { autoplay: 1, mute: 1, controls: 0, rel: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, disablekb: 1, fs: 0, start: 10, origin: window.location.origin, widget_referrer: 'hero-widget' },
          events: {
            onReady: (event: any) => {
              const attemptPlay = (retries = 3) => {
                try {
                  // Try to respect mute preference immediately
                  if (!isMutedRef.current) {
                    event.target.unMute();
                  } else {
                    event.target.mute();
                  }

                  event.target.seekTo(10, true);
                  event.target.playVideo();

                  setTimeout(() => {
                    try {
                      if (event.target.getPlayerState && typeof event.target.getPlayerState === 'function') {
                        const state = event.target.getPlayerState();
                        if (state !== 1 && retries > 0) attemptPlay(retries - 1);
                      }
                    } catch (e) { }
                  }, 1000);
                } catch (e) {
                  console.warn("YouTube unmuted autoplay failed, falling back to muted");
                  try {
                    event.target.mute();
                    event.target.playVideo();
                  } catch (err) { }

                  if (retries > 0) setTimeout(() => attemptPlay(retries - 1), 1000);
                }
              };
              attemptPlay();
            },
            onStateChange: (event: any) => {
              if (!PlayerState) return;
              if (event.data === PlayerState.PLAYING) {
                if (trailerLoadTimeoutRef.current) { clearTimeout(trailerLoadTimeoutRef.current); trailerLoadTimeoutRef.current = null; }
                // Clear the main safety timeout to prevent cutting off the video
                if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }

                setYtVideoReady(true);
                if (progressAnimationFrameRef.current) cancelAnimationFrame(progressAnimationFrameRef.current);
                clearProgressInterval();
                advanceTriggeredRef.current = false;

                let lastTime = -1;
                let stalledCount = 0;

                // Use 800ms interval instead of 500ms to reduce CPU usage
                progressIntervalRef.current = setInterval(() => {
                  try {
                    const duration = event.target.getDuration?.();
                    const currentTime = event.target.getCurrentTime?.();

                    // Stalled detection (stuck buffering or frozen > 15s)
                    if (currentTime === lastTime) {
                      stalledCount++;
                      if (stalledCount > 18) { // 18 * 800ms = ~15s stalled detection
                        clearProgressInterval();
                        clearAdvanceTimeout();
                        advanceSlide();
                      }
                    } else {
                      stalledCount = 0;
                      lastTime = currentTime;
                    }

                    if (duration && currentTime) {
                      const p = (currentTime / duration) * 100;
                      setProgress(p);
                      // If within end offset, schedule advance quickly (500ms instead of 4000ms)
                      if (!advanceTriggeredRef.current && duration - currentTime <= endOffsetSeconds) {
                        clearProgressInterval();
                        clearAdvanceTimeout();
                        advanceTimeoutRef.current = setTimeout(() => {
                          advanceTimeoutRef.current = null;
                          advanceSlide();
                        }, 500);
                      }
                    }
                  } catch { }
                }, 800); // Increased from 500ms for better performance
              } else if (event.data === PlayerState.ENDED) {
                setYtVideoReady(false);
                setProgress(100);
                clearProgressInterval();
                clearAdvanceTimeout();
                advanceTimeoutRef.current = setTimeout(() => {
                  advanceTimeoutRef.current = null;
                  advanceSlide();
                }, 500);
              }
            },
            onError: () => {
              clearProgressInterval(); clearAdvanceTimeout(); advanceTimeoutRef.current = setTimeout(() => { advanceTimeoutRef.current = null; advanceSlide(); }, 1000);
            }
          },
        });
      } catch (e) { }
    };
    return () => { clearInterval(checkEl); clearTimeout(timeout); try { playerRef.current?.destroy?.(); } catch { } clearProgressInterval(); clearAdvanceTimeout(); playerRef.current = null; };
  }, [current, ytReady, isTrailer, getTrailerKey, advanceSlide, clearProgressInterval, clearAdvanceTimeout, endOffsetSeconds]);

  // Clean timeouts on unmount
  useEffect(() => {
    return () => {
      clearProgressInterval();
      clearAdvanceTimeout();
      if (trailerLoadTimeoutRef.current) {
        clearTimeout(trailerLoadTimeoutRef.current);
        trailerLoadTimeoutRef.current = null;
      }
    };
  }, [clearProgressInterval, clearAdvanceTimeout]);

  // Sync mute
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.isMuted === "function") { try { if (isMuted) playerRef.current.mute(); else playerRef.current.unMute(); } catch { } }
    if (videoRef.current) { videoRef.current.muted = isMuted; videoRef.current.volume = isMuted ? 0 : 1; }
  }, [isMuted]);

  // Native Video Logic
  useEffect(() => {
    if (!current || isTrailer(current)) { if (videoRef.current && isTrailer(current)) videoRef.current.pause(); return; }
    const video = videoRef.current;
    if (!video) return;
    clearProgressInterval();
    advanceTriggeredRef.current = false;
    setProgress(0);
    let ended = false;

    const startPlayback = () => {
      try {
        if (Math.abs(video.currentTime) > 0.5) video.currentTime = 0;
      } catch { }

      // Attempt unmuted playback first if configured
      video.muted = isMutedRef.current;
      video.volume = isMutedRef.current ? 0 : 1;

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          // Playback started successfully
        }).catch(error => {
          console.warn('HeroVideoWidget: Unmuted autoplay blocked, falling back to muted');
          video.muted = true;
          video.volume = 0;
          video.play().catch(() => { });
        });
      }
    };

    const handleLoaded = () => startPlayback();

    let lastTime = -1;
    let stalledCount = 0;

    const handleTimeUpdate = () => {
      // Clear safety timeout once playback starts
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }

      if (ended) return;

      // Stalled detection
      if (video.currentTime === lastTime) {
        stalledCount++;
        // If stuck for > 5 seconds (approx 15 updates at 300ms intervals, but timeupdate fires irregularly)
        // timeupdate typically fires 4Hz-60Hz. stricter check needed.
        if (stalledCount > 20) {
          console.log('HeroVideoWidget: Native video stalled, advancing');
          ended = true;
          clearAdvanceTimeout();
          advanceSlide();
          return;
        }
      } else {
        stalledCount = 0;
        lastTime = video.currentTime;
      }

      if (video.duration) {
        const p = (video.currentTime / video.duration) * 100;
        setProgress(p);
        if (video.duration - video.currentTime <= 0.2) {
          ended = true;
          clearAdvanceTimeout();
          advanceTimeoutRef.current = setTimeout(() => {
            advanceTimeoutRef.current = null;
            advanceSlide();
          }, 500);
        }
      }
    };

    const handleEnded = () => {
      if (ended) return;
      ended = true;
      setProgress(100);
      // Clear the fallback timeout since video ended naturally
      if (timerRef.current) clearTimeout(timerRef.current);
      clearAdvanceTimeout();
      advanceTimeoutRef.current = setTimeout(() => {
        advanceTimeoutRef.current = null;
        advanceSlide();
      }, 1000);
    };

    const handleError = () => {
      if (ended) return;
      ended = true;
      // Clear the fallback timeout since we're handling the error
      if (timerRef.current) clearTimeout(timerRef.current);
      clearAdvanceTimeout();
      advanceTimeoutRef.current = setTimeout(() => {
        advanceTimeoutRef.current = null;
        advanceSlide();
      }, 2000);
    };

    video.muted = isMutedRef.current;
    video.volume = isMutedRef.current ? 0 : 1;
    if (video.readyState >= 1) startPlayback();

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);

    return () => {
      ended = true;
      video.pause();
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
      clearAdvanceTimeout();
    };
  }, [current, isTrailer, advanceSlide, clearProgressInterval, clearAdvanceTimeout]);

  // Reset states
  useEffect(() => { setImageLoaded(false); setYtVideoReady(false); setProgress(0); }, [current]);

  const renderTrailer = useCallback(() => {
    if (!current) return null;
    const key = getTrailerKey(current);
    if (!key) return null;
    return (
      <motion.div key={`youtube-trailer-${current.id}`} initial={{ opacity: 0 }} animate={{ opacity: ytVideoReady ? 1 : 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden pointer-events-none" style={{ clipPath: 'inset(0)' }}>
        <div className="relative w-full h-full overflow-hidden">
          <div id={`yt-player-hero-${current.id}`} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ width: '120vw', height: '120vh', minWidth: '200vh', minHeight: '70vw', pointerEvents: 'none' }} />
        </div>
      </motion.div>
    );
  }, [current, getTrailerKey, ytVideoReady]);

  const renderNativeVideo = useCallback(() => {
    let src = "";
    if (current) {
      // Check for local trailer first (if mode allows)
      if (mode !== 'preview' && current.trailer_path && !extractYouTubeKey(current.trailer_path)) {
        if (current.trailer_path.startsWith('http')) {
          src = current.trailer_path;
        } else if (current.trailer_path.startsWith('/')) {
          src = `${apiUrl}${current.trailer_path}`;
        } else {
          // Relative path or filename
          src = `${apiUrl}/api/assets/${current.trailer_path}`;
        }
      }
      // Fallback to preview clip
      if (!src) {
        src = `${apiUrl}/api/preview-clips/${current.id}?quality=high&format=mp4&cache=true`;
      }
    }

    return <video key={current?.id || "preview"} ref={videoRef} autoPlay muted={isMuted} playsInline className="absolute inset-0 w-full h-full object-cover z-10" src={src} />;
  }, [apiUrl, current, isMuted, mode, extractYouTubeKey]);

  if (!current) return null;

  const releaseYear = current ? getYear(current) : null;
  const displayRating = current ? getDisplayRating(current) : null;
  const recommendationScore = scoreData?.score || (current ? calculateMockScore(current) : null);
  const logoUrl = current ? getLogoUrl(current) : "";

  // Dynamic Theme
  const primaryGenre = current.genre_names?.[0] || current.genres?.[0]?.name || "";
  const theme = getGenreTheme(primaryGenre);

  return (
    <div className={`relative w-full h-[450px] md:h-[550px] lg:h-[650px] xl:h-[750px] overflow-hidden rounded-2xl shadow-2xl ${className}`}>
      {/* Preload hints for upcoming videos */}
      {items.slice(index, index + 3).map((item) => (
        (item.file_path || item.preview_path) && (
          <link
            key={`preload-${item.id}`}
            rel="preload"
            as="video"
            href={getPreviewClipUrl(item)}
            crossOrigin="anonymous"
          />
        )
      ))}
      {/* Custom Tag/Heading */}
      {config?.showTag && config?.tagText && (
        <div className="absolute top-6 left-6 z-40 pointer-events-none">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border font-semibold text-sm shadow-lg"
            style={{
              backgroundColor: config.tagColor || 'rgba(255,255,255,0.1)',
              borderColor: config.tagColor ? `${config.tagColor}60` : 'rgba(255,255,255,0.2)',
              color: 'white',
              boxShadow: `0 0 20px ${config.tagColor || 'rgba(255,255,255)'}40, 0 4px 12px rgba(0,0,0,0.3)`,
              textShadow: '0 1px 2px rgba(0,0,0,0.8)'
            }}
          >
            <TagIcon className="w-4 h-4 drop-shadow-sm" />
            <span className="uppercase tracking-wider font-bold text-xs">
              {config.tagText}
            </span>
          </div>
        </div>
      )}

      {config?.showHeading && config?.headingText && (
        <div className="absolute top-6 left-6 z-40 pointer-events-none" style={{ marginTop: config?.showTag && config?.tagText ? '60px' : '0' }}>
          <h3
            className="text-2xl md:text-3xl font-bold text-white drop-shadow-2xl"
            style={{
              textShadow: `0 0 20px rgba(255,255,255,0.3), 0 2px 10px rgba(0,0,0,0.8)`
            }}
          >
            {config.headingText}
          </h3>
        </div>
      )}

      {/* Backdrop */}
      <AnimatePresence mode="wait">
        <motion.div key={index} initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: imageLoaded ? 1 : 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 1, ease: "easeOut" }} className="absolute inset-0">
          <motion.img src={getBackdropUrl(current)} alt={current.title} className="w-full h-full object-cover" animate={{ scale: [1, 1.05] }} transition={{ duration: 20, repeat: Infinity, repeatType: "reverse", ease: "linear" }} onLoad={() => setImageLoaded(true)} onError={(e) => { (e.target as HTMLImageElement).src = `${apiUrl}/api/thumbnails/${current.id}`; }} />
        </motion.div>
      </AnimatePresence>

      {/* Video */}
      <AnimatePresence mode="wait">{isTrailer(current) ? renderTrailer() : renderNativeVideo()}</AnimatePresence>

      {/* Gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={current.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10, transition: { duration: 0.2 } }} transition={{ delay: 0.1, duration: 0.4 }} className="absolute bottom-12 left-8 right-8 z-20">
          <div className="flex items-end gap-6">
            {/* Poster */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.3 }} className="hidden md:block relative">
              <div className={`absolute -inset-1 bg-gradient-to-r from-red-500/30 to-purple-500/30 rounded-lg blur-lg`} />
              <img src={getPosterUrl(current)} alt={current.title} onError={(e) => { const target = e.target as HTMLImageElement; if (current.tmdb_poster_url && target.src !== current.tmdb_poster_url) { target.src = current.tmdb_poster_url; } else { target.src = `${apiUrl}/api/thumbnails/${current.id}`; } }} className="relative w-28 md:w-32 lg:w-36 aspect-[2/3] rounded-lg object-cover shadow-2xl ring-1 ring-white/20" />
            </motion.div>

            <div className="flex-1 min-w-0">
              {/* Logo/Title - Clickable */}
              <button
                onClick={() => navigateToMedia(navigate, current)}
                className="bg-transparent border-0 p-0 m-0 text-left focus:outline-none cursor-pointer group"
                style={{ display: 'block' }}
              >
                {logoUrl ? (
                  <motion.img
                    src={logoUrl}
                    alt={current.title}
                    className="max-h-16 md:max-h-24 w-auto mb-4 drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] transition-transform duration-300 group-hover:scale-[1.02]"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                  />
                ) : (
                  <motion.h2
                    className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3 text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] transition-colors duration-300 group-hover:text-white"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                  >
                    {current.title}
                  </motion.h2>
                )}
              </button>

              {/* Badges - Dynamic Colors & Reduced Sizes */}
              <motion.div className="flex flex-wrap items-center gap-2 text-xs mb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.4 }}>
                {recommendationScore && (
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-semibold backdrop-blur-sm border ${theme.bg} ${theme.text} ${theme.border}`}>
                    <ThumbsUp className="w-3 h-3" />
                    {recommendationScore}% Match
                  </span>
                )}
                {releaseYear && (
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full backdrop-blur-sm border ${theme.bg} ${theme.text} ${theme.border}`}>
                    <Calendar className="w-3 h-3" />
                    {releaseYear}
                  </span>
                )}
                {displayRating && (
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full backdrop-blur-sm border ${theme.bg} ${theme.text} ${theme.border}`}>
                    <Star className="w-3 h-3 fill-current" />
                    {displayRating.toFixed(1)}
                  </span>
                )}
                {current.quality && (
                  <span className={`px-2 py-0.5 rounded backdrop-blur-sm border font-bold ${theme.bg} ${theme.text} ${theme.border}`}>
                    {current.quality.toUpperCase().includes('4K') || current.quality.includes('2160') ? '4K' : 'HD'}
                  </span>
                )}
              </motion.div>

              {/* Genres */}
              {((current.genre_names?.length ?? 0) > 0 || (current.genres?.length ?? 0) > 0) && (
                <motion.div
                  className="flex flex-wrap items-center gap-2 mb-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.55, duration: 0.4 }}
                >
                  {(current.genre_names || current.genres?.map((g: any) => g.name) || []).slice(0, 3).map((genre: string, idx: number) => (
                    <span key={idx} className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-600/40 border border-red-500/30 text-white backdrop-blur-md">
                      {genre}
                    </span>
                  ))}
                </motion.div>
              )}

              <motion.p className="text-white/70 text-xs md:text-sm max-w-xl line-clamp-2 mb-4 leading-relaxed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.4 }}>{current.description || current.short_desc || current.long_desc}</motion.p>

              <motion.div className="flex items-center gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.4 }}>
                {hasLocalFile(current) && (
                  <button
                    onClick={() => {
                      setSelectedMediaForPlayback(current);
                      setShowVideoPlayer(true);
                    }}
                    className="group p-2 rounded-full bg-red-600/40 border border-red-500/30 text-white backdrop-blur-md hover:bg-red-600/60 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110"
                    title="Play"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                )}
                <button onClick={() => navigateToMedia(navigate, current)} className="group p-2 bg-white/20 text-white rounded-full backdrop-blur-md border border-white/30 hover:bg-white/30 transition-all duration-200 hover:scale-110" title="More Info">
                  <Info className="w-4 h-4" />
                </button>
                
                {/* MyListTooltip for Add to List */}
                <MyListTooltip
                  media={{
                    ...current,
                    id: current.tmdb_id ? parseInt(`9${current.tmdb_id}`) : current.id
                  }}
                  isInMyList={isInMyList(current.tmdb_id ? parseInt(`9${current.tmdb_id}`) : current.id)}
                  collections={collections}
                  onToggleMyList={() => toggleMyList(current.tmdb_id ? parseInt(`9${current.tmdb_id}`) : current.id)}
                  onAddToCollection={(collectionId) => addToCollection(collectionId, current.tmdb_id ? parseInt(`9${current.tmdb_id}`) : current.id)}
                  onCollectionCreated={fetchCollections}
                >
                  <button
                    className="group p-2 bg-white/20 text-white rounded-full backdrop-blur-md border border-white/30 hover:bg-white/30 transition-all duration-200 hover:scale-110"
                    title={isInMyList(current.tmdb_id ? parseInt(`9${current.tmdb_id}`) : current.id) ? "Remove from My List" : "Add to My List"}
                  >
                    {isInMyList(current.tmdb_id ? parseInt(`9${current.tmdb_id}`) : current.id) ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </button>
                </MyListTooltip>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Volume */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.4 }} className="absolute top-6 right-6 z-30">
        <button onClick={() => setIsMuted((m) => !m)} className="group p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/20 hover:bg-black/60 hover:border-white/40 transition-all duration-200 hover:scale-110" title={isMuted ? "Unmute" : "Mute"}>
          {isMuted ? <VolumeX className="w-4 h-4 text-white/80 group-hover:text-white transition-colors" /> : <Volume2 className="w-4 h-4 text-white/80 group-hover:text-white transition-colors" />}
        </button>
      </motion.div>

      {/* Indicators - Circular & Reduced Height */}
      {items.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.4 }} className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30">
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-lg">
            {items.map((item, idx) => {
              // Should allow different themes for each item? Yes, assuming we hovered it? 
              // Actually usually indicators are uniform or based on currentslide.
              // I'll use the theme of the *current* slide for the active dot.
              const isActive = idx === index;
              return (
                <div key={item.id} className="relative group flex items-center justify-center">
                  <button
                    onClick={() => goToIndex(idx)}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className={`relative rounded-full transition-all duration-300 flex items-center justify-center ${isActive ? 'w-4 h-4' : 'w-2 h-2 hover:scale-125'
                      }`}
                  >
                    {/* Background Dot */}
                    <div className={`absolute inset-0 rounded-full transition-colors duration-300 ${isActive ? 'bg-transparent' : 'bg-white/40 group-hover:bg-white/80'
                      } ${!isActive ? '' : ''}`} />

                    {/* Active Ring Progress */}
                    {isActive && (
                      <svg className="absolute inset-0 w-full h-full -rotate-90">
                        {/* Track */}
                        <circle cx="50%" cy="50%" r="6" stroke="currentColor" strokeWidth="2" fill="none" className="text-white/10" />
                        {/* Progress */}
                        <circle cx="50%" cy="50%" r="6" stroke="currentColor" strokeWidth="2" fill="none"
                          className={theme.text}
                          strokeDasharray="37.7" // 2*PI*r (r=6 -> ~37.7)
                          strokeDashoffset={37.7 - (37.7 * progress / 100)}
                          strokeLinecap="round"
                        />
                        {/* Center Dot */}
                        <circle cx="50%" cy="50%" r="2" fill="currentColor" className={theme.text} />
                      </svg>
                    )}
                  </button>

                  {/* Hover Tooltip */}
                  <AnimatePresence>
                    {hoveredIndex === idx && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-48 p-2 rounded-xl bg-black/90 backdrop-blur-xl border border-white/10 shadow-2xl z-50 flex gap-3 items-center pointer-events-none"
                      >
                        <img src={getPosterUrl(item)} alt={item.title} className="w-10 h-14 rounded object-cover shadow-lg bg-white/10" onError={(e) => { (e.target as HTMLImageElement).src = `${apiUrl}/api/thumbnails/${item.id}`; }} />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-xs font-bold text-white truncate">{item.title}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                            <span className="text-[10px] text-white/70">{getDisplayRating(item) || 'N/A'}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Accents */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-red-500/10 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-tl from-purple-500/10 to-transparent pointer-events-none" />

      {/* Video Player Overlay */}
      <VideoPlayerOverlay
        media={selectedMediaForPlayback}
        isOpen={showVideoPlayer}
        onClose={() => {
          setShowVideoPlayer(false);
          setSelectedMediaForPlayback(null);
        }}
      />
    </div>
  );
}