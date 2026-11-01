"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info, Play, Volume2, VolumeX } from "lucide-react";
import { loadYouTubeAPI, YT_STATE } from "@/lib/youtube";

export interface TVHeroSlide {
  id: string;
  title: string;
  overview?: string;
  backdrop?: string | null;
  logo?: string | null;
  /** Short facts shown under the title, e.g. ["2024", "Drama", "TV-MA"]. */
  meta?: (string | number | null | undefined)[];
  /** Small label above the title, e.g. a provider logo or "New Episode". */
  eyebrow?: React.ReactNode;
  /** YouTube key, or a resolver called lazily when the slide becomes active. */
  trailerKey?: string | null;
  resolveTrailer?: () => Promise<string | null>;
}

interface TVHeroProps {
  slides: TVHeroSlide[];
  onPrimary?: (slide: TVHeroSlide, index: number) => void;
  onSecondary?: (slide: TVHeroSlide, index: number) => void;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryIcon?: React.ReactNode;
  secondaryIcon?: React.ReactNode;
  /** Rotation interval when no trailer is playing. */
  interval?: number;
  /** Play muted trailer previews in the background. */
  previews?: boolean;
  /** Content rendered at the top of the hero (e.g. a back button). */
  topSlot?: React.ReactNode;
  className?: string;
}

const PREVIEW_DELAY_MS = 2500;

/**
 * Apple TV app style hero: full-bleed artwork, title treatment, two pill
 * buttons, page indicators, and an optional muted trailer preview that fades
 * in over the artwork. One YouTube player is created and reused.
 */
export default function TVHero({
  slides,
  onPrimary,
  onSecondary,
  primaryLabel = "Play",
  secondaryLabel = "Details",
  primaryIcon,
  secondaryIcon,
  interval = 9000,
  previews = true,
  topSlot,
  className = "",
}: TVHeroProps) {
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false); // hover/focus pauses rotation

  const hostRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const pendingKeyRef = useRef<string | null>(null);
  const slidesRef = useRef(slides);
  slidesRef.current = slides;

  const count = slides.length;
  const slide = slides[Math.min(index, Math.max(0, count - 1))];

  const go = useCallback(
    (i: number) => {
      const n = slidesRef.current.length;
      if (n) setIndex(((i % n) + n) % n);
    },
    []
  );

  // Clamp the index if the slide list shrinks.
  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count, index]);

  // Auto-rotate unless a trailer is playing or the user is interacting.
  useEffect(() => {
    if (count < 2 || playing || paused) return;
    const t = setTimeout(() => go(index + 1), interval);
    return () => clearTimeout(t);
  }, [index, count, playing, paused, interval, go]);

  // Resolve the active slide's trailer after a short dwell.
  useEffect(() => {
    setTrailerKey(null);
    setPlaying(false);
    if (!previews || !slide) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const key = slide.trailerKey ?? (slide.resolveTrailer ? await slide.resolveTrailer() : null);
      if (!cancelled && key) setTrailerKey(key);
    }, PREVIEW_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide?.id, previews]);

  const loadKey = (key: string | null) => {
    const p = playerRef.current;
    if (!p || !readyRef.current) {
      pendingKeyRef.current = key;
      return;
    }
    if (key && !document.hidden) p.loadVideoById({ videoId: key, startSeconds: 3 });
    else p.stopVideo?.();
  };

  // Create the player lazily the first time a trailer is needed.
  useEffect(() => {
    if (!trailerKey) {
      loadKey(null);
      return;
    }
    if (playerRef.current) {
      loadKey(trailerKey);
      return;
    }
    pendingKeyRef.current = trailerKey;
    let cancelled = false;
    loadYouTubeAPI()
      .then((YT) => {
        if (cancelled || playerRef.current || !sizerRef.current) return;
        const target = document.createElement("div");
        sizerRef.current.appendChild(target);
        playerRef.current = new YT.Player(target, {
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0, mute: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3,
            modestbranding: 1, playsinline: 1, rel: 0, origin: window.location.origin,
          },
          events: {
            onReady: () => {
              readyRef.current = true;
              playerRef.current.mute();
              loadKey(pendingKeyRef.current);
            },
            onStateChange: (e: any) => {
              if (e.data === YT_STATE.PLAYING) setPlaying(true);
              if (e.data === YT_STATE.ENDED) {
                setPlaying(false);
                setTrailerKey(null);
                if (slidesRef.current.length > 1) setIndex((i) => (i + 1) % slidesRef.current.length);
              }
            },
            onError: () => {
              setPlaying(false);
              setTrailerKey(null);
            },
          },
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailerKey]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    if (muted) p.mute();
    else p.unMute();
  }, [muted, playing]);

  useEffect(() => {
    const onVis = () => {
      const p = playerRef.current;
      if (!p || !readyRef.current) return;
      if (document.hidden) p.pauseVideo();
      else if (trailerKey) p.playVideo();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [trailerKey]);

  useEffect(
    () => () => {
      try {
        playerRef.current?.destroy();
      } catch {
        /* gone */
      }
      playerRef.current = null;
      readyRef.current = false;
    },
    []
  );

  // Cover-fit the 16:9 iframe, overscanned to crop YouTube chrome.
  useEffect(() => {
    const host = hostRef.current;
    const sizer = sizerRef.current;
    if (!host || !sizer) return;
    const fit = () => {
      const { width: w, height: h } = host.getBoundingClientRect();
      let vw = w;
      let vh = (w * 9) / 16;
      if (vh < h) {
        vh = h;
        vw = (h * 16) / 9;
      }
      sizer.style.width = `${vw * 1.2}px`;
      sizer.style.height = `${vh * 1.2}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  if (!slide) return null;

  const meta = (slide.meta || []).filter((m) => m !== null && m !== undefined && m !== "");

  return (
    <section
      className={`relative h-[72vh] min-h-[480px] w-full overflow-hidden md:h-[86vh] md:max-h-[920px] ${className}`}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={slide.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {slide.backdrop ? (
            <motion.img
              src={slide.backdrop}
              alt=""
              className="h-full w-full object-cover"
              initial={{ scale: 1.06 }}
              animate={{ scale: 1 }}
              transition={{ duration: 9, ease: "linear" }}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
          )}
        </motion.div>
      </AnimatePresence>

      <div
        ref={hostRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-1000 ${
          playing ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          ref={sizerRef}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 [&>iframe]:h-full [&>iframe]:w-full"
        />
      </div>

      {/* Scrims: Apple TV keeps artwork bright and darkens only the text area. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/25 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/60 to-transparent" />

      {topSlot && <div className="tv-gutter absolute inset-x-0 top-20 z-10 md:top-24">{topSlot}</div>}

      <div className="tv-gutter relative z-10 flex h-full flex-col justify-end pb-14 md:pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
            className="max-w-[min(42rem,100%)]"
          >
            {slide.eyebrow && <div className="mb-4">{slide.eyebrow}</div>}
            {slide.logo ? (
              <img
                src={slide.logo}
                alt={slide.title}
                className="mb-5 max-h-24 w-auto max-w-[75%] object-contain object-left drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)] md:max-h-36"
              />
            ) : (
              <h1 className="mb-4 text-4xl font-bold leading-[1.02] tracking-[-0.03em] drop-shadow-[0_2px_16px_rgba(0,0,0,0.5)] md:text-6xl">
                {slide.title}
              </h1>
            )}
            {meta.length > 0 && (
              <p className="text-[15px] font-medium text-white/80">{meta.join("  ·  ")}</p>
            )}
            {slide.overview && (
              <p className="mt-3 line-clamp-3 max-w-xl text-[15px] leading-relaxed text-white/75 md:text-[17px]">
                {slide.overview}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {onPrimary && (
                <button type="button" className="tv-btn tv-btn-primary" onClick={() => onPrimary(slide, index)}>
                  {primaryIcon ?? <Play className="h-[18px] w-[18px] fill-current" />}
                  {primaryLabel}
                </button>
              )}
              {onSecondary && (
                <button type="button" className="tv-btn tv-btn-secondary" onClick={() => onSecondary(slide, index)}>
                  {secondaryIcon ?? <Info className="h-[18px] w-[18px]" />}
                  {secondaryLabel}
                </button>
              )}
              {trailerKey && (
                <button
                  type="button"
                  className="tv-btn tv-btn-secondary tv-btn-icon"
                  aria-label={muted ? "Unmute preview" : "Mute preview"}
                  onClick={() => setMuted((m) => !m)}
                >
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {count > 1 && (
        <div className="absolute bottom-6 right-4 z-10 flex items-center gap-1.5 md:bottom-8 md:right-12 xl:right-16" role="tablist">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show ${s.title}`}
              onClick={() => go(i)}
              className={`tv-focus h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
