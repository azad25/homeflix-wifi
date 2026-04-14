import { useState, useRef, useCallback, useEffect } from 'react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';

// Module-level YouTube API loader — shared across all hook instances, loads only once
let ytApiPromise: Promise<void> | null = null;
function ensureYouTubeAPI(): Promise<void> {
  if ((window as any).YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve) => {
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      try { prev?.(); } catch {}
      resolve();
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
    // Safety: if API already loaded between check and script add
    if ((window as any).YT?.Player) resolve();
  });
  return ytApiPromise;
}

// Module-level cache for fetched trailer keys (avoid re-fetching)
const trailerKeyCache = new Map<number, string | null>();

/**
 * Lightweight hook for hover-triggered video on cards.
 * Tries YouTube trailer first (fetches from TMDB API if needed),
 * falls back to native preview clip.
 * Does NO work until the card is actually hovered for the delay period.
 */
export function useHoverVideo(media: Media, hoverDelayMs = 600) {
  const apiUrl = getApiUrl();
  const [isHovered, setIsHovered] = useState(false);
  const [shouldPlay, setShouldPlay] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [useYouTube, setUseYouTube] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destroyedRef = useRef(false);
  const ytContainerIdRef = useRef(`yt-hover-${media.id}-${Math.random().toString(36).slice(2, 6)}`);

  // --- Helpers ---

  const getTmdbType = useCallback((): 'movie' | 'tv' => {
    if (media.media_type === 'tv' || media.type === 'tv' || media.type === 'series' || media.type === 'episode') {
      return 'tv';
    }
    return 'movie';
  }, [media.media_type, media.type]);

  const getActualTmdbId = useCallback((): number | null => {
    if (media.tmdb_id && media.tmdb_id > 0) return media.tmdb_id;

    // Some TMDB entries are stored as prefixed IDs like 9{tmdbId}
    // (used elsewhere to avoid collisions with local-media IDs).
    if (media.media_type && Number.isFinite(media.id)) {
      const idStr = String(media.id);
      if (idStr.startsWith('9') && idStr.length > 1) {
        const decoded = Number(idStr.slice(1));
        if (Number.isFinite(decoded) && decoded > 0) {
          return decoded;
        }
      }
    }

    if (media.id && media.id > 0) return media.id;
    return null;
  }, [media.tmdb_id, media.media_type, media.id]);

  const extractYouTubeKey = useCallback((url: string): string | null => {
    if (!url) return null;
    const m = url.trim().match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/
    );
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
    return null;
  }, []);

  /** Get trailer key from media fields (no network call) */
  const getLocalTrailerKey = useCallback((): string | null => {
    if (media.tmdb_trailer_url) {
      const k = extractYouTubeKey(media.tmdb_trailer_url);
      if (k) return k;
    }
    if (media.trailer_path) {
      const k = extractYouTubeKey(media.trailer_path);
      if (k) return k;
    }
    if ((media as any).series?.tmdb_trailer_url) {
      const k = extractYouTubeKey((media as any).series.tmdb_trailer_url);
      if (k) return k;
    }
    // Check module-level cache
    const actualTmdbId = getActualTmdbId();
    if (actualTmdbId && trailerKeyCache.has(actualTmdbId)) {
      return trailerKeyCache.get(actualTmdbId) || null;
    }
    return null;
  }, [media.tmdb_trailer_url, media.trailer_path, (media as any).series?.tmdb_trailer_url, getActualTmdbId, extractYouTubeKey]);

  /** Fetch trailer key from TMDB API (only if tmdb_id exists and not already cached) */
  const fetchTrailerKey = useCallback(async (actualTmdbId: number): Promise<string | null> => {
    if (!actualTmdbId) return null;
    if (trailerKeyCache.has(actualTmdbId)) return trailerKeyCache.get(actualTmdbId) || null;

    const findBestTrailerKey = (videos: any[]): string | null => {
      const ytVideos = (videos || []).filter((v: any) => v?.site === 'YouTube' && v?.key);
      let trailer = ytVideos.find((v: any) => v.official && v.type === 'Trailer');
      if (trailer) return trailer.key;
      trailer = ytVideos.find((v: any) => v.type === 'Trailer');
      if (trailer) return trailer.key;
      trailer = ytVideos.find((v: any) => v.type === 'Teaser');
      if (trailer) return trailer.key;
      return ytVideos[0]?.key || null;
    };

    try {
      const type = getTmdbType();
      let key: string | null = null;

      // Primary endpoint for hover widgets
      const res = await fetch(`${apiUrl}/api/tmdb/${type}/${actualTmdbId}/videos`);
      if (res.ok) {
        const data = await res.json();
        key = findBestTrailerKey(data.results || []);
      }

      // Fallback to the same endpoint/path pattern used on tmdb detail page
      if (!key) {
        const detailsRes = await fetch(`${apiUrl}/api/tmdb-movie/${actualTmdbId}?type=${type}`);
        if (detailsRes.ok) {
          const detailsData = await detailsRes.json();
          const wrappedVideos = detailsData?.data?.videos?.results;
          const directVideos = detailsData?.videos?.results;
          key = findBestTrailerKey(wrappedVideos || directVideos || []);
        }
      }

      trailerKeyCache.set(actualTmdbId, key);
      return key;
    } catch {
      trailerKeyCache.set(actualTmdbId, null);
      return null;
    }
  }, [apiUrl, getTmdbType]);

  const getPreviewClipUrl = useCallback((): string => {
    return `${apiUrl}/api/preview-clips/${media.id}?quality=medium&format=mp4&cache=true`;
  }, [apiUrl, media.id]);

  // --- Full cleanup ---
  const fullCleanup = useCallback(() => {
    destroyedRef.current = true;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.pause(); videoRef.current.removeAttribute('src'); videoRef.current.load(); } catch {}
    }
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch {}
      ytPlayerRef.current = null;
    }
    setShouldPlay(false);
    setVideoReady(false);
    setUseYouTube(false);
  }, []);

  // --- Mouse handlers ---
  const onMouseEnter = useCallback(() => {
    setIsHovered(true);
    destroyedRef.current = false;
    hoverTimerRef.current = setTimeout(() => {
      setShouldPlay(true);
    }, hoverDelayMs);
  }, [hoverDelayMs]);

  const onMouseLeave = useCallback(() => {
    setIsHovered(false);
    fullCleanup();
  }, [fullCleanup]);

  // --- Create YouTube player ---
  const createYTPlayer = useCallback((ytKey: string) => {
    if (destroyedRef.current) return;

    const tryCreate = (attempt = 0) => {
      if (destroyedRef.current) return;
      const el = document.getElementById(ytContainerIdRef.current);
      if (!el) {
        // Some card layouts render the container a bit later; retry briefly.
        if (attempt < 8) {
          setTimeout(() => tryCreate(attempt + 1), 50);
          return;
        }
        console.warn('[useHoverVideo] YouTube container element not found:', ytContainerIdRef.current);
        setUseYouTube(false);
        return;
      }

      try {
        const YT = (window as any).YT;
        if (!YT?.Player) { 
          console.warn('[useHoverVideo] YouTube API not loaded');
          setUseYouTube(false); 
          return; 
        }

        console.log('[useHoverVideo] Creating YouTube player for:', ytKey, 'media:', media.title);
        ytPlayerRef.current = new YT.Player(ytContainerIdRef.current, {
          videoId: ytKey,
          playerVars: {
            autoplay: 1, mute: 1, controls: 0, rel: 0,
            iv_load_policy: 3, modestbranding: 1, playsinline: 1,
            disablekb: 1, fs: 0, start: 10,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              if (destroyedRef.current) return;
              console.log('[useHoverVideo] YouTube player ready for:', media.title);
              // Make iframe visible as soon as it's ready; PLAYING state can be delayed on some devices.
              setVideoReady(true);
              try {
                event.target.mute();
                event.target.seekTo(10, true);
                event.target.playVideo();
              } catch (err) {
                console.error('[useHoverVideo] Error starting playback:', err);
              }

              // Retry autoplay once if first play attempt is ignored.
              setTimeout(() => {
                if (destroyedRef.current) return;
                try {
                  const state = event.target.getPlayerState?.();
                  const PS = (window as any).YT?.PlayerState;
                  if (PS && state !== PS.PLAYING) {
                    event.target.playVideo();
                  }
                } catch {}
              }, 500);
            },
            onStateChange: (event: any) => {
              if (destroyedRef.current) return;
              const PS = (window as any).YT?.PlayerState;
              if (PS && (event.data === PS.PLAYING || event.data === PS.BUFFERING || event.data === PS.CUED)) {
                console.log('[useHoverVideo] YouTube trailer playing for:', media.title);
                setVideoReady(true);
              }
              if (PS && event.data === PS.PLAYING) {
                // Unmute after playback has started (browser allows this)
                try {
                  event.target.unMute();
                  event.target.setVolume(50);
                } catch {}
              }
            },
            onError: (event: any) => {
              if (destroyedRef.current) return;
              console.error('[useHoverVideo] YouTube player error:', event.data, 'for:', media.title);
              setUseYouTube(false);
              try { ytPlayerRef.current?.destroy(); } catch {}
              ytPlayerRef.current = null;
            },
          },
        });
      } catch (err) {
        console.error('[useHoverVideo] Error creating YouTube player:', err);
        setUseYouTube(false);
      }
    };

    // Wait for DOM element to render (2 frames for React to flush)
    requestAnimationFrame(() => {
      if (destroyedRef.current) return;
      requestAnimationFrame(() => {
        if (destroyedRef.current) return;
        tryCreate();
      });
    });
  }, [media.title]);

  // --- Activate video when shouldPlay turns true ---
  useEffect(() => {
    if (!shouldPlay) return;
    let cancelled = false;

    const activate = async () => {
      // 1. Try to get trailer key locally first
      let ytKey = getLocalTrailerKey();

      // 2. If no local key but has tmdb_id, fetch from API
      const actualTmdbId = getActualTmdbId();
      if (!ytKey && actualTmdbId) {
        ytKey = await fetchTrailerKey(actualTmdbId);
      }

      if (cancelled || destroyedRef.current) return;

      if (ytKey) {
        // YouTube trailer path
        setUseYouTube(true);
        // Avoid showing loading UI/spinners while YouTube iframe initializes.
        setVideoReady(true);
        await ensureYouTubeAPI();
        if (cancelled || destroyedRef.current) return;
        createYTPlayer(ytKey);
      } else {
        // Native preview path — video element auto-plays via autoPlay attribute
        setUseYouTube(false);
      }
    };

    activate();

    return () => { cancelled = true; };
  }, [shouldPlay, getLocalTrailerKey, fetchTrailerKey, createYTPlayer, getActualTmdbId]);

  // Cleanup on unmount
  useEffect(() => {
    return fullCleanup;
  }, [fullCleanup]);

  return {
    isHovered,
    shouldPlay,
    videoReady,
    useYouTube,
    videoRef,
    ytContainerId: ytContainerIdRef.current,
    onMouseEnter,
    onMouseLeave,
    getPreviewClipUrl,
    setVideoReady,
  };
}
