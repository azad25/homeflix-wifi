"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Volume2,
  VolumeX,
  Star,
  Info,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCcw,
  Film,
  CalendarClock,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { getApiUrl } from "@/lib/api";
import { loadYouTubeAPI, YT_STATE, extractYouTubeKey, muteAllTrailers } from "@/lib/youtube";
import { useRouter } from "next/navigation";

const TMDB_GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
};

type CategoryKey = "upcoming" | "now-playing" | "popular";

const CATEGORIES: { key: CategoryKey; label: string; endpoint: string }[] = [
  { key: "upcoming", label: "Coming Soon", endpoint: "/api/tmdb/movie/upcoming" },
  { key: "now-playing", label: "In Theaters", endpoint: "/api/tmdb/movie/now-playing" },
  { key: "popular", label: "Popular", endpoint: "/api/tmdb/movie/popular" },
];

// How many titles per category get enriched with videos + logos.
const ITEMS_PER_CATEGORY = 16;
// Skip studio cards / black frames at the top of the background preview.
const HERO_START_SECONDS = 4;

interface TrailerVideo {
  key: string;
  name: string;
  type: string;
  official: boolean;
}

interface TrailerMovie {
  id: number;
  title: string;
  overview: string;
  backdrop_path: string;
  poster_path: string;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  videos: TrailerVideo[];
  logoUrl?: string;
}

const VIDEO_TYPE_RANK: Record<string, number> = { Trailer: 0, Teaser: 1, Clip: 2, Featurette: 3 };

function rankVideos(raw: any[]): TrailerVideo[] {
  const seen = new Set<string>();
  return raw
    .filter((v) => v && v.site === "YouTube" && v.type in VIDEO_TYPE_RANK)
    .map((v) => ({
      key: extractYouTubeKey(v.key) || "",
      name: v.name || v.type,
      type: v.type,
      official: !!v.official,
    }))
    .filter((v) => v.key && !seen.has(v.key) && seen.add(v.key))
    .sort(
      (a, b) =>
        VIDEO_TYPE_RANK[a.type] - VIDEO_TYPE_RANK[b.type] ||
        Number(b.official) - Number(a.official)
    );
}

const tmdbImage = (path?: string, size = "original") => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

const releaseYear = (date?: string) => (date ? new Date(date).getFullYear() : null);

const isUpcoming = (date?: string) => !!date && new Date(date).getTime() > Date.now();

const formatRelease = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

async function fetchCategory(category: CategoryKey, signal: AbortSignal): Promise<TrailerMovie[]> {
  const apiUrl = getApiUrl();
  const cat = CATEGORIES.find((c) => c.key === category)!;
  const res = await fetch(`${apiUrl}${cat.endpoint}?page=1`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const results: any[] = (data.results || []).filter((m: any) => m && m.id).slice(0, ITEMS_PER_CATEGORY);

  const enriched = await Promise.all(
    results.map(async (movie): Promise<TrailerMovie> => {
      const [videos, logoUrl] = await Promise.all([
        fetch(`${apiUrl}/api/tmdb-movie/${movie.id}?type=movie`, { signal })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => rankVideos(d?.data?.videos?.results || d?.videos?.results || []))
          .catch(() => [] as TrailerVideo[]),
        fetch(`${apiUrl}/api/tmdb/movie/${movie.id}/images`, { signal })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            const logos: any[] = d?.logos || [];
            const best = logos.find((l) => l.iso_639_1 === "en") || logos[0];
            return best?.file_path ? tmdbImage(best.file_path, "w500") : undefined;
          })
          .catch(() => undefined),
      ]);
      return {
        id: movie.id,
        title: movie.title || movie.name || "Untitled",
        overview: movie.overview || "",
        backdrop_path: movie.backdrop_path || "",
        poster_path: movie.poster_path || "",
        release_date: movie.release_date || "",
        vote_average: Number(movie.vote_average) || 0,
        genre_ids: movie.genre_ids || [],
        videos,
        logoUrl,
      };
    })
  );

  return enriched.filter((m) => m.videos.length > 0);
}

export default function TrailersPage() {
  const router = useRouter();

  const [category, setCategory] = useState<CategoryKey>("upcoming");
  const [items, setItems] = useState<TrailerMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const cacheRef = useRef<Partial<Record<CategoryKey, TrailerMovie[]>>>({});

  const [activeIndex, setActiveIndex] = useState(0);
  const [videoIndex, setVideoIndex] = useState(0); // which of the movie's videos the hero plays
  const [isMuted, setIsMuted] = useState(true);
  const [heroPlaying, setHeroPlaying] = useState(false);
  const [modal, setModal] = useState<{ movie: TrailerMovie; videoKey: string } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const heroHostRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false);
  const autoplayRef = useRef(true);

  const activeMovie: TrailerMovie | undefined = items[activeIndex];
  const activeVideo = activeMovie?.videos[videoIndex];

  // Refs mirror the latest values for the YouTube event callbacks, which are
  // bound once when the player is created.
  const stateRef = useRef({ items, activeIndex, videoIndex, isMuted, modalOpen: false });
  stateRef.current = { items, activeIndex, videoIndex, isMuted, modalOpen: !!modal };

  // ---------- data ----------
  useEffect(() => {
    const cached = cacheRef.current[category];
    setActiveIndex(0);
    setVideoIndex(0);
    if (cached) {
      setItems(cached);
      setLoading(false);
      setLoadError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setLoadError(null);
    fetchCategory(category, ctrl.signal)
      .then((list) => {
        cacheRef.current[category] = list;
        setItems(list);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        console.error("Failed to load trailers:", err);
        setItems([]);
        setLoadError("Couldn't load trailers. Check that your TMDB API key is configured.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [category, reloadToken]);

  // ---------- navigation ----------
  const goTo = useCallback((index: number) => {
    const len = stateRef.current.items.length;
    if (!len) return;
    setActiveIndex(((index % len) + len) % len);
    setVideoIndex(0);
  }, []);

  const next = useCallback(() => goTo(stateRef.current.activeIndex + 1), [goTo]);
  const prev = useCallback(() => goTo(stateRef.current.activeIndex - 1), [goTo]);

  // ---------- hero player (created once, reused for every trailer) ----------
  useEffect(() => {
    autoplayRef.current = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;

    loadYouTubeAPI()
      .then((YT) => {
        if (cancelled || !sizerRef.current) return;
        // The API replaces its target node with an iframe, so give it a node
        // React doesn't own.
        const target = document.createElement("div");
        sizerRef.current.appendChild(target);
        playerRef.current = new YT.Player(target, {
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            mute: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              playerReadyRef.current = true;
              const { items, activeIndex, videoIndex, isMuted } = stateRef.current;
              const key = items[activeIndex]?.videos[videoIndex]?.key;
              if (isMuted) playerRef.current.mute();
              else playerRef.current.unMute();
              if (key) loadHeroVideo(key);
            },
            onStateChange: (e: any) => {
              if (e.data === YT_STATE.PLAYING) setHeroPlaying(true);
              if (e.data === YT_STATE.ENDED) {
                setHeroPlaying(false);
                if (stateRef.current.items.length > 1) next();
                else playerRef.current?.seekTo(0, true);
              }
            },
            onError: () => {
              // 101/150: embedding disabled; 100: removed. Try the movie's
              // next video, then move on to the next title.
              setHeroPlaying(false);
              const { items, activeIndex, videoIndex } = stateRef.current;
              const movie = items[activeIndex];
              if (movie && videoIndex + 1 < movie.videos.length) setVideoIndex(videoIndex + 1);
              else if (items.length > 1) next();
            },
          },
        });
      })
      .catch((err) => console.warn("YouTube player unavailable:", err));

    return () => {
      cancelled = true;
      playerReadyRef.current = false;
      try {
        playerRef.current?.destroy();
      } catch {
        /* already gone */
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadHeroVideo = (key: string) => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;
    const opts = { videoId: key, startSeconds: HERO_START_SECONDS };
    if (autoplayRef.current && !stateRef.current.modalOpen && !document.hidden) player.loadVideoById(opts);
    else player.cueVideoById(opts);
  };

  // Switch the hero trailer in place instead of rebuilding the player.
  useEffect(() => {
    setHeroPlaying(false);
    rootRef.current?.style.setProperty("--trailer-progress", "0");
    if (activeVideo?.key) loadHeroVideo(activeVideo.key);
    else playerRef.current?.stopVideo?.();
  }, [activeVideo?.key]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;
    if (isMuted) player.mute();
    else player.unMute();
  }, [isMuted]);

  // Pause the background trailer while the full player is open or the tab is hidden.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;
    if (modal) player.pauseVideo();
    else if (autoplayRef.current && activeVideo) player.playVideo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal]);

  useEffect(() => {
    const onVisibility = () => {
      const player = playerRef.current;
      if (!player || !playerReadyRef.current) return;
      if (document.hidden) player.pauseVideo();
      else if (autoplayRef.current && !stateRef.current.modalOpen) player.playVideo();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Progress is written to a CSS variable so the 4Hz updates don't re-render the page.
  useEffect(() => {
    const id = setInterval(() => {
      const player = playerRef.current;
      if (!player || !playerReadyRef.current || typeof player.getDuration !== "function") return;
      const duration = player.getDuration() || 0;
      const current = player.getCurrentTime() || 0;
      const ratio = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
      rootRef.current?.style.setProperty("--trailer-progress", ratio.toFixed(4));
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Size the iframe to "cover" the hero at any aspect ratio, slightly
  // overscanned so YouTube's title/branding chrome is cropped out.
  useEffect(() => {
    const host = heroHostRef.current;
    const sizer = sizerRef.current;
    if (!host || !sizer) return;
    const resize = () => {
      const { width: w, height: h } = host.getBoundingClientRect();
      const overscan = 1.18;
      let vw = w, vh = (w * 9) / 16;
      if (vh < h) {
        vh = h;
        vw = (h * 16) / 9;
      }
      sizer.style.width = `${vw * overscan}px`;
      sizer.style.height = `${vh * overscan}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // Keep the active card visible in the rail without scrolling the page.
  useEffect(() => {
    const rail = railRef.current;
    const card = rail?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (!rail || !card) return;
    const left = card.offsetLeft - rail.offsetLeft;
    if (left < rail.scrollLeft || left + card.offsetWidth > rail.scrollLeft + rail.clientWidth) {
      rail.scrollTo({ left: Math.max(0, left - 24), behavior: "smooth" });
    }
  }, [activeIndex]);

  // ---------- modal ----------
  const openPlayer = (movie: TrailerMovie, videoKey?: string) => {
    const key = videoKey || movie.videos[0]?.key;
    if (key) {
      muteAllTrailers(); // the page hero goes quiet while the pop-up plays
      setModal({ movie, videoKey: key });
    }
  };

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [modal]);

  const genres = useMemo(
    () => (activeMovie?.genre_ids || []).map((id) => TMDB_GENRES[id]).filter(Boolean).slice(0, 3),
    [activeMovie]
  );

  const scrollRail = (dir: 1 | -1) => {
    const rail = railRef.current;
    if (rail) rail.scrollBy({ left: dir * rail.clientWidth * 0.8, behavior: "smooth" });
  };

  const showEmpty = !loading && items.length === 0;

  return (
    <div
      ref={rootRef}
      className="min-h-screen overflow-x-hidden bg-[#0b0b0d] text-white"
      style={{ ["--trailer-progress" as any]: 0 }}
    >
      <Navbar />

      {/* ---------- HERO ---------- */}
      <section className="relative h-[78vh] min-h-[520px] w-full overflow-hidden md:h-[88vh]">
        {/* Backdrop (shown until the trailer is actually playing) */}
        <AnimatePresence>
          {activeMovie && (activeMovie.backdrop_path || activeMovie.poster_path) && (
            <motion.img
              key={activeMovie.id}
              src={tmdbImage(activeMovie.backdrop_path || activeMovie.poster_path, "original")}
              alt=""
              initial={{ opacity: 0 }}
              animate={{ opacity: heroPlaying ? 0 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </AnimatePresence>

        {/* Single persistent YouTube player */}
        <div
          ref={heroHostRef}
          className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-700 ${
            heroPlaying ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden="true"
        >
          <div
            ref={sizerRef}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 [&>iframe]:h-full [&>iframe]:w-full"
          />
        </div>

        {/* Scrims */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0d] via-[#0b0b0d]/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#0b0b0d] via-[#0b0b0d]/60 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />

        {/* Content */}
        <div className="relative z-10 mx-auto flex h-full max-w-[1600px] flex-col justify-end px-4 pb-16 md:px-8 md:pb-24 lg:px-12">
          {/* Category tabs */}
          <div role="tablist" aria-label="Trailer categories" className="mb-6 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                role="tab"
                aria-selected={category === c.key}
                onClick={() => setCategory(c.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  category === c.key
                    ? "bg-white text-black"
                    : "border border-white/20 bg-black/30 text-white/80 backdrop-blur-sm hover:bg-white/10"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="max-w-2xl animate-pulse space-y-4">
              <div className="h-14 w-3/4 rounded-lg bg-white/10 md:h-20" />
              <div className="h-4 w-1/3 rounded bg-white/10" />
              <div className="h-4 w-full rounded bg-white/10" />
              <div className="h-4 w-5/6 rounded bg-white/10" />
              <div className="flex gap-3 pt-3">
                <div className="h-12 w-40 rounded-md bg-white/15" />
                <div className="h-12 w-36 rounded-md bg-white/10" />
              </div>
            </div>
          ) : showEmpty ? (
            <div className="max-w-xl">
              <Film className="mb-4 h-10 w-10 text-white/40" />
              <h1 className="text-3xl font-bold md:text-4xl">No trailers to show</h1>
              <p className="mt-3 text-white/70">
                {loadError || "None of these titles have a YouTube trailer yet. Try another category."}
              </p>
              <button
                onClick={() => {
                  delete cacheRef.current[category];
                  setReloadToken((t) => t + 1);
                }}
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-bold text-black hover:bg-white/90"
              >
                <RotateCcw className="h-4 w-4" /> Retry
              </button>
            </div>
          ) : (
            activeMovie && (
              <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeMovie.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35 }}
                    className="max-w-2xl"
                  >
                    {activeMovie.logoUrl ? (
                      <img
                        src={activeMovie.logoUrl}
                        alt={activeMovie.title}
                        className="mb-5 max-h-24 w-auto max-w-[80%] object-contain object-left drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] md:max-h-36"
                      />
                    ) : (
                      <h1 className="mb-4 text-4xl font-black leading-[1.05] tracking-tight drop-shadow-lg md:text-6xl">
                        {activeMovie.title}
                      </h1>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/80">
                      {isUpcoming(activeMovie.release_date) ? (
                        <span className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {formatRelease(activeMovie.release_date)}
                        </span>
                      ) : (
                        releaseYear(activeMovie.release_date) && (
                          <span className="font-semibold">{releaseYear(activeMovie.release_date)}</span>
                        )
                      )}
                      {activeMovie.vote_average > 0 && (
                        <span className="inline-flex items-center gap-1 font-semibold text-yellow-400">
                          <Star className="h-3.5 w-3.5 fill-yellow-400" />
                          {activeMovie.vote_average.toFixed(1)}
                        </span>
                      )}
                      {genres.length > 0 && <span className="text-white/60">{genres.join(" · ")}</span>}
                      {activeVideo && (
                        <span className="rounded border border-white/30 px-1.5 py-px text-[11px] font-semibold uppercase tracking-wider text-white/70">
                          {activeVideo.type}
                        </span>
                      )}
                    </div>

                    {activeMovie.overview && (
                      <p className="mt-4 line-clamp-3 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">
                        {activeMovie.overview}
                      </p>
                    )}

                    <div className="mt-7 flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => openPlayer(activeMovie, activeVideo?.key)}
                        className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-base font-bold text-black transition hover:bg-white/85"
                      >
                        <Play className="h-5 w-5 fill-black" />
                        Watch Trailer
                      </button>
                      <button
                        onClick={() => router.push(`/tmdb-movie/${activeMovie.id}?type=movie`)}
                        className="inline-flex items-center gap-2 rounded-md bg-white/20 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/30"
                      >
                        <Info className="h-5 w-5" />
                        More Info
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Hero controls */}
                <div className="flex items-center gap-2 md:pb-1">
                  <button
                    onClick={() => setIsMuted((m) => !m)}
                    aria-label={isMuted ? "Unmute preview" : "Mute preview"}
                    className="rounded-full border border-white/40 bg-black/30 p-2.5 backdrop-blur-sm transition hover:border-white hover:bg-white/10"
                  >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                  {items.length > 1 && (
                    <>
                      <button
                        onClick={prev}
                        aria-label="Previous trailer"
                        className="rounded-full border border-white/40 bg-black/30 p-2.5 backdrop-blur-sm transition hover:border-white hover:bg-white/10"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <span className="min-w-[3.5rem] text-center text-sm tabular-nums text-white/70">
                        {activeIndex + 1} / {items.length}
                      </span>
                      <button
                        onClick={next}
                        aria-label="Next trailer"
                        className="rounded-full border border-white/40 bg-black/30 p-2.5 backdrop-blur-sm transition hover:border-white hover:bg-white/10"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        {/* Hero progress */}
        <div className="absolute inset-x-0 bottom-0 z-10 h-[3px] bg-white/10">
          <div
            className="h-full origin-left bg-red-600 transition-transform duration-300 ease-linear"
            style={{ transform: "scaleX(var(--trailer-progress))" }}
          />
        </div>
      </section>

      {/* ---------- RAIL ---------- */}
      {items.length > 0 && (
        <section className="relative mx-auto mt-6 max-w-[1600px] pb-20">
          <div className="mb-4 flex items-end justify-between px-4 md:px-8 lg:px-12">
            <h2 className="text-xl font-bold md:text-2xl">
              {CATEGORIES.find((c) => c.key === category)?.label} Trailers
            </h2>
            <div className="hidden gap-2 md:flex">
              <button
                onClick={() => scrollRail(-1)}
                aria-label="Scroll left"
                className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => scrollRail(1)}
                aria-label="Scroll right"
                className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            ref={railRef}
            className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 md:gap-4 md:scroll-px-8 md:px-8 lg:scroll-px-12 lg:px-12"
          >
            {items.map((movie, index) => {
              const active = index === activeIndex;
              return (
                <div
                  key={movie.id}
                  data-index={index}
                  className={`group relative w-[260px] shrink-0 snap-start overflow-hidden rounded-lg bg-white/5 transition md:w-[320px] ${
                    active ? "ring-2 ring-white" : "ring-1 ring-white/10 hover:ring-white/40"
                  }`}
                >
                  <button
                    onClick={() => goTo(index)}
                    aria-label={`Preview ${movie.title}`}
                    aria-current={active}
                    className="block w-full text-left"
                  >
                    <div className="relative aspect-video overflow-hidden">
                      {movie.backdrop_path || movie.poster_path ? (
                        <img
                          src={tmdbImage(movie.backdrop_path || movie.poster_path, "w780")}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/5">
                          <Film className="h-8 w-8 text-white/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                      {movie.logoUrl ? (
                        <img
                          src={movie.logoUrl}
                          alt={movie.title}
                          loading="lazy"
                          className="absolute bottom-3 left-3 max-h-10 max-w-[65%] object-contain object-left drop-shadow"
                        />
                      ) : (
                        <span className="absolute bottom-3 left-3 right-14 line-clamp-2 text-base font-bold drop-shadow">
                          {movie.title}
                        </span>
                      )}
                      {active && (
                        <span className="absolute left-3 top-3 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          Now previewing
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs text-white/60">
                      <span className="truncate">
                        {isUpcoming(movie.release_date)
                          ? `Coming ${formatRelease(movie.release_date)}`
                          : releaseYear(movie.release_date) ?? ""}
                      </span>
                      <span className="shrink-0">
                        {movie.videos.length} video{movie.videos.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </button>

                  {/* Play full trailer */}
                  <button
                    onClick={() => openPlayer(movie)}
                    aria-label={`Watch ${movie.title} trailer`}
                    className="absolute right-3 top-[calc(56.25%-3.25rem)] flex h-10 w-10 items-center justify-center rounded-full bg-white text-black opacity-90 shadow-lg transition hover:scale-110 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  >
                    <Play className="ml-0.5 h-4 w-4 fill-black" />
                  </button>

                  {active && (
                    <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
                      <div
                        className="h-full origin-left bg-red-600 transition-transform duration-300 ease-linear"
                        style={{ transform: "scaleX(var(--trailer-progress))" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- FULL PLAYER ---------- */}
      <AnimatePresence>
        {modal && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-0 backdrop-blur-md md:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModal(null)}
            role="dialog"
            aria-modal="true"
            aria-label={`${modal.movie.title} trailer`}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-6xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-4 px-4 md:px-0">
                <h3 className="truncate text-lg font-bold md:text-xl">{modal.movie.title}</h3>
                <button
                  autoFocus
                  onClick={() => setModal(null)}
                  aria-label="Close trailer"
                  className="shrink-0 rounded-full bg-white/10 p-2 transition hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative aspect-video w-full overflow-hidden bg-black md:rounded-xl">
                <iframe
                  key={modal.videoKey}
                  src={`https://www.youtube-nocookie.com/embed/${modal.videoKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                  title={`${modal.movie.title} trailer`}
                  className="absolute inset-0 h-full w-full"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>

              {modal.movie.videos.length > 1 && (
                <div className="scrollbar-hide mt-4 flex gap-2 overflow-x-auto px-4 md:px-0">
                  {modal.movie.videos.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => setModal({ movie: modal.movie, videoKey: v.key })}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        v.key === modal.videoKey
                          ? "bg-white text-black"
                          : "bg-white/10 text-white/80 hover:bg-white/20"
                      }`}
                      title={v.name}
                    >
                      <span className="max-w-[16rem] truncate">{v.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
