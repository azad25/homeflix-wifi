"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellRing, Check, Info, Play, Volume2, VolumeX, X } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { muteAllTrailers } from "@/lib/youtube";
import { useNavigate } from "@/hooks/useNavigate";

export interface ComingSoonItem {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  overview: string;
  tagline?: string;
  release_date: string;
  release_label?: string;
  season?: number;
  days_until: number;
  poster_url: string;
  backdrop_url: string;
  genres: string[];
  cast: string[];
  studio?: string;
  rank: number;
  trailer: { state: string; video_url?: string; youtube_id: string; width?: number; height?: number; duration?: number };
  notify: { on: boolean; status?: string };
}

const when = (it: ComingSoonItem) => {
  const d = new Date(it.release_date + "T00:00:00");
  const date = d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
  if (it.days_until <= 1) return "Tomorrow";
  if (it.days_until <= 45) return `In ${it.days_until} days · ${date}`;
  return date;
};

/**
 * Coming Soon: the most anticipated upcoming movies / series. The stage plays
 * the server's downloaded trailer (YouTube as a fallback) and moves to the
 * next title when it ends; "Notify Me" queues the title for Auto Download on
 * release day.
 */
export default function ComingSoonShowcase({ type, className = "" }: { type?: "movie" | "tv"; className?: string }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"movie" | "tv">(type || "movie");
  const [data, setData] = useState<{ movies: ComingSoonItem[]; series: ComingSoonItem[] } | null>(null);
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [yt, setYt] = useState<ComingSoonItem | null>(null);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiUrl()}/api/comingsoon${type ? `?type=${type}` : ""}`, { cache: "no-store" });
      if (!r.ok) return setData({ movies: [], series: [] });
      const d = await r.json();
      setData({ movies: d.movies || [], series: d.series || [] });
    } catch {
      setData({ movies: [], series: [] });
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  // Fall back to the other type when one is empty (only on the first load).
  useEffect(() => {
    if (!data || type) return;
    const mine = tab === "movie" ? data.movies : data.series;
    const other = tab === "movie" ? data.series : data.movies;
    if (mine.length === 0 && other.length) setTab(tab === "movie" ? "tv" : "movie");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data === null]);
  const items = useMemo(() => (data ? (tab === "movie" ? data.movies : data.series) : null), [data, tab]);
  // A new list (other tab) starts at the top; updates (Notify Me) keep the position.
  useEffect(() => setIdx(0), [tab]);

  // Only play while the stage is on screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting && e.intersectionRatio > 0.35), { threshold: [0, 0.35, 0.6] });
    io.observe(el);
    return () => io.disconnect();
  }, [items]);

  const cur = items && items.length ? items[Math.min(idx, items.length - 1)] : null;
  const local = cur?.trailer.video_url ? `${getApiUrl()}${cur.trailer.video_url}` : "";

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inView) v.play().catch(() => {});
    else v.pause();
  }, [inView, local]);

  // Without a local trailer, rotate every 9 s.
  useEffect(() => {
    if (!items || items.length < 2 || local || !inView) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % items.length), 9000);
    return () => clearTimeout(t);
  }, [idx, items, local, inView]);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    if (muted) muteAllTrailers();
    v.muted = !muted;
    setMuted(!muted);
  };

  const notify = async () => {
    if (!cur) return;
    setBusy(true);
    try {
      const on = cur.notify.on;
      const r = on
        ? await fetch(`${getApiUrl()}/api/comingsoon/notify/${cur.media_type}/${cur.tmdb_id}`, { method: "DELETE" })
        : await fetch(`${getApiUrl()}/api/comingsoon/notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ media_type: cur.media_type, tmdb_id: cur.tmdb_id }),
          });
      if (r.ok) {
        const flip = (l: ComingSoonItem[]) => l.map((x) => (x.tmdb_id === cur.tmdb_id && x.media_type === cur.media_type ? { ...x, notify: { on: !on, status: on ? "" : "scheduled" } } : x));
        setData((d) => (d ? { movies: flip(d.movies), series: flip(d.series) } : d));
      }
    } finally {
      setBusy(false);
    }
  };

  if (!data || !items || items.length === 0 || !cur) return null;
  const details = `/tmdb-movie/${cur.tmdb_id}?type=${cur.media_type}`;

  return (
    <section ref={rootRef} className={`tv-gutter ${className}`} aria-label="Coming Soon">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[24px] font-bold tracking-[-0.02em] text-white md:text-[28px]">Coming Soon</h2>
          <p className="mt-0.5 text-[13px] text-white/50">
            The most anticipated {type === "tv" ? "series" : type === "movie" ? "movies" : "movies and series"} of this year and next
          </p>
        </div>
        {!type && (
          <div role="radiogroup" aria-label="Coming Soon type" className="inline-flex rounded-full bg-white/[0.08] p-0.5">
            {(["movie", "tv"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tab === t}
                onClick={() => setTab(t)}
                disabled={(t === "movie" ? data.movies : data.series).length === 0}
                className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-30 ${tab === t ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
              >
                {t === "movie" ? "Movies" : "Series"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stage */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[24px] bg-[#0b0b0d] ring-1 ring-inset ring-white/[0.07] sm:aspect-[16/9] md:aspect-[21/9]">
        <AnimatePresence mode="sync">
          <motion.div key={`${cur.media_type}-${cur.tmdb_id}`} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.backdrop_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {local && (
              <video
                ref={videoRef}
                key={local}
                src={local}
                poster={cur.backdrop_url}
                muted={muted}
                playsInline
                autoPlay={inView}
                preload="metadata"
                onEnded={() => setIdx((i) => (i + 1) % items.length)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
          </motion.div>
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent sm:bg-gradient-to-r sm:from-black/85 sm:via-black/35" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

        <div className="absolute inset-y-0 left-0 flex max-w-[640px] flex-col justify-end p-5 md:p-10">
          <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur-xl">
            {cur.release_label ? `${cur.release_label} · ` : ""}
            {when(cur)}
          </span>
          <h3 className="text-[28px] font-bold leading-[1.05] tracking-[-0.03em] text-white md:text-[46px]">{cur.title}</h3>
          <p className="mt-2 text-[13px] font-medium text-white/65 md:text-[14px]">
            {[cur.studio, cur.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
          </p>
          {cur.overview && <p className="mt-2 line-clamp-2 hidden text-[14px] leading-relaxed text-white/75 md:block md:text-[15px]">{cur.overview}</p>}
          {cur.cast.length > 0 && <p className="mt-2 hidden truncate text-[13px] text-white/55 md:block">Starring {cur.cast.slice(0, 3).join(", ")}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={notify}
              disabled={busy}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-semibold transition ${
                cur.notify.on ? "bg-white/15 text-white ring-1 ring-inset ring-white/25 hover:bg-white/25" : "bg-white text-black hover:bg-white/90"
              }`}
            >
              {cur.notify.on ? <Check className="h-[18px] w-[18px]" /> : <Bell className="h-[18px] w-[18px]" />}
              {cur.notify.on ? "We'll Notify You" : "Notify Me"}
            </button>
            {!local && cur.trailer.youtube_id && (
              <button type="button" onClick={() => { muteAllTrailers(); setYt(cur); }} className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2.5 text-[15px] font-semibold text-white backdrop-blur-xl hover:bg-white/25">
                <Play className="h-4 w-4 fill-current" /> Trailer
              </button>
            )}
            <button type="button" onClick={() => navigate.push(details)} aria-label="Details" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-xl hover:bg-white/25">
              <Info className="h-5 w-5" />
            </button>
            {local && (
              <button type="button" onClick={toggleSound} aria-label={muted ? "Unmute trailer" : "Mute trailer"} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-xl hover:bg-white/25">
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            )}
          </div>
          {cur.notify.on && (
            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-white/55">
              <BellRing className="h-3.5 w-3.5" /> Added to Auto Download - HomeFlix gets it on release day.
            </p>
          )}
        </div>
      </div>

      {/* Rail */}
      <div className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
        {items.map((it, i) => (
          <button
            key={`${it.media_type}-${it.tmdb_id}`}
            type="button"
            onClick={() => setIdx(i)}
            aria-current={i === idx ? "true" : undefined}
            className={`group relative w-[180px] shrink-0 overflow-hidden rounded-[14px] text-left transition md:w-[220px] ${
              i === idx ? "ring-2 ring-white" : "opacity-70 ring-1 ring-white/[0.08] hover:opacity-100"
            }`}
          >
            <span className="relative block aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.backdrop_url.replace("/w1280/", "/w500/")} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              {it.notify.on && (
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-black">
                  <Bell className="h-3.5 w-3.5" />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 p-2.5">
                <span className="block truncate text-[13px] font-semibold text-white">{it.title}</span>
                <span className="block truncate text-[11px] text-white/60">{it.release_label ? `${it.release_label} · ` : ""}{new Date(it.release_date + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* YouTube fallback player */}
      <AnimatePresence>
        {yt && (
          <motion.div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setYt(null)}>
            <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[17px] font-semibold text-white">{yt.title}</p>
                <button type="button" onClick={() => setYt(null)} aria-label="Close trailer" className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="aspect-video overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
                <iframe src={`https://www.youtube-nocookie.com/embed/${yt.trailer.youtube_id}?autoplay=1&rel=0`} title={yt.title} allow="autoplay; encrypted-media; fullscreen" allowFullScreen className="h-full w-full" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
