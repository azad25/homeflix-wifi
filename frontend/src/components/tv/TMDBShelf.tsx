"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Play, Star, Volume2, VolumeX } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { loadYouTubeAPI } from "@/lib/youtube";
import { useNavigate } from "@/hooks/useNavigate";
import AutoDownloadButton from "@/components/autodl/AutoDownloadButton";
import TVShelf from "./TVShelf";

export interface ShelfItem {
  id: number;
  media_type: "movie" | "tv";
  title: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  date?: string;
  rating?: number;
  local_id?: number;
}

// One request per shelf / trailer for the whole session.
const shelfCache = new Map<string, Promise<{ title: string; items: ShelfItem[] }>>();
const trailerCache = new Map<string, Promise<string>>();

const loadShelf = (name: string) => {
  if (!shelfCache.has(name)) {
    const p = fetch(`${getApiUrl()}/api/tmdb/shelf/${name}`)
      .then((r) => (r.ok ? r.json() : { title: "", items: [] }))
      .then((d) => ({ title: d.title || "", items: (d.items || []) as ShelfItem[] }))
      .catch(() => ({ title: "", items: [] as ShelfItem[] }));
    shelfCache.set(name, p);
    // Retry on a later visit if this one failed or came back empty.
    p.then((d) => d.items.length === 0 && shelfCache.delete(name));
  }
  return shelfCache.get(name)!;
};

const loadTrailer = (type: string, id: number) => {
  const k = `${type}:${id}`;
  if (!trailerCache.has(k)) {
    trailerCache.set(
      k,
      fetch(`${getApiUrl()}/api/tmdb/trailer/${type}/${id}`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((d: { youtube_id?: string }) => d.youtube_id || "")
        .catch(() => "")
    );
  }
  return trailerCache.get(k)!;
};

const img = (p?: string, size = "w780") => (p ? `https://image.tmdb.org/t/p/${size}${p}` : "");
const canHover = () => typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

/** Backdrop card; after a short hover the trailer plays in place (muted, sound on request). */
function TrailerCard({ item }: { item: ShelfItem }) {
  const navigate = useNavigate();
  const [hover, setHover] = useState(false);
  const [videoId, setVideoId] = useState("");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [imgOk, setImgOk] = useState(true);
  const holderRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const dwell = useRef<ReturnType<typeof setTimeout> | null>(null);

  const year = item.date ? item.date.slice(0, 4) : "";
  const href = item.local_id
    ? item.media_type === "tv"
      ? `/tv-series/${item.local_id}`
      : `/movie/${item.local_id}`
    : `/tmdb-movie/${item.id}?type=${item.media_type}`;

  const stop = useCallback(() => {
    if (dwell.current) clearTimeout(dwell.current);
    dwell.current = null;
    try {
      playerRef.current?.destroy?.();
    } catch {
      /* already gone */
    }
    playerRef.current = null;
    setPlaying(false);
    setVideoId("");
    setMuted(true);
  }, []);

  useEffect(() => stop, [stop]);

  const enter = () => {
    setHover(true);
    if (!canHover()) return;
    dwell.current = setTimeout(async () => {
      const key = await loadTrailer(item.media_type, item.id);
      if (key && dwell.current !== null) setVideoId(key);
    }, 650);
  };
  const leave = () => {
    setHover(false);
    stop();
  };

  // Create the player once there's a trailer and a mount point.
  useEffect(() => {
    if (!videoId || !holderRef.current) return;
    let cancelled = false;
    const mount = document.createElement("div");
    holderRef.current.innerHTML = "";
    holderRef.current.appendChild(mount);
    loadYouTubeAPI().then((YT) => {
      if (cancelled || !YT) return;
      playerRef.current = new YT.Player(mount, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, mute: 1, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, start: 4 },
        events: {
          onReady: (e: any) => {
            e.target.mute();
            e.target.playVideo();
          },
          onStateChange: (e: any) => {
            if (e.data === 1) setPlaying(true); // playing
            if (e.data === 0) {
              setPlaying(false); // ended: back to the artwork
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const toggleSound = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const p = playerRef.current;
    if (!p) return;
    if (muted) {
      p.unMute?.();
      p.setVolume?.(80);
    } else p.mute?.();
    setMuted(!muted);
  };

  return (
    <div
      className="w-[280px] shrink-0 md:w-[340px]"
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
    >
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          navigate.push(href);
        }}
        aria-label={`${item.title}${year ? `, ${year}` : ""}`}
        className={`group relative block aspect-video overflow-hidden rounded-[16px] bg-white/[0.06] ring-1 ring-inset ring-white/[0.07] transition-all duration-300 ease-out ${
          hover ? "z-10 scale-[1.04] shadow-[0_24px_60px_rgba(0,0,0,0.65)] ring-white/30" : ""
        }`}
      >
        {imgOk && item.backdrop_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img(item.backdrop_path)} alt="" loading="lazy" onError={() => setImgOk(false)} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/10 to-white/[0.02] px-4 text-center text-[15px] font-semibold text-white/70">
            {item.title}
          </div>
        )}

        {/* Trailer: fades in over the artwork once it's actually playing */}
        {videoId && (
          <div className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${playing ? "opacity-100" : "opacity-0"}`}>
            {/* oversize the iframe so YouTube's letterboxing and chrome fall outside the card */}
            <div ref={holderRef} className="absolute left-1/2 top-1/2 h-[136%] w-[136%] -translate-x-1/2 -translate-y-1/2 [&>iframe]:h-full [&>iframe]:w-full" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {item.local_id ? (
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-black shadow">
            <CheckCircle2 className="h-3.5 w-3.5" /> In Library
          </span>
        ) : item.media_type === "tv" ? (
          <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-xl">Series</span>
        ) : null}

        {playing && (
          <button
            type="button"
            onClick={toggleSound}
            aria-label={muted ? "Unmute trailer" : "Mute trailer"}
            className="absolute right-3 top-3 rounded-full bg-black/45 p-2 text-white ring-1 ring-white/20 backdrop-blur-xl transition hover:bg-black/70"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-bold tracking-[-0.01em] text-white drop-shadow">{item.title}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-white/70">
              {item.rating ? (
                <span className="flex items-center gap-0.5 text-white/90">
                  <Star className="h-3 w-3 fill-current" />
                  {item.rating.toFixed(1)}
                </span>
              ) : null}
              {item.rating && year ? <span className="text-white/35">·</span> : null}
              {year && <span>{year}</span>}
            </p>
          </div>
          <div className={`flex shrink-0 items-center gap-2 transition-opacity duration-200 ${hover ? "opacity-100" : "opacity-0"}`}>
            {!item.local_id && (
              <AutoDownloadButton compact tmdbId={item.id} mediaType={item.media_type} title={item.title} year={year ? Number(year) : undefined} posterPath={item.poster_path} />
            )}
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-lg">
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </span>
          </div>
        </div>
      </a>
    </div>
  );
}

/** A TMDB row (trending, popular, ...) that loads when it scrolls near. */
export default function TMDBShelf({ name, title, subtitle, className = "" }: { name: string; title?: string; subtitle?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ title: string; items: ShelfItem[] } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          loadShelf(name).then(setData);
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [name]);

  if (data && data.items.length === 0) return null;
  return (
    <div ref={ref} className={className}>
      {!data ? (
        <div className="tv-gutter">
          <div className="mb-3 h-6 w-48 animate-pulse rounded bg-white/[0.06]" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="aspect-video w-[280px] shrink-0 animate-pulse rounded-[16px] bg-white/[0.05] md:w-[340px]" />
            ))}
          </div>
        </div>
      ) : (
        <TVShelf title={title || data.title} subtitle={subtitle}>
          {data.items.map((it) => (
            <TrailerCard key={`${it.media_type}-${it.id}`} item={it} />
          ))}
        </TVShelf>
      )}
    </div>
  );
}
