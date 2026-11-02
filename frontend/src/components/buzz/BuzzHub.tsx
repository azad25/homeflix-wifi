"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, CalendarDays, ExternalLink, Newspaper, Play, Sparkles, User, X } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import AutoDownloadButton from "@/components/autodl/AutoDownloadButton";

export interface BuzzItem {
  id: string;
  kind: "news" | "video";
  title: string;
  summary?: string;
  url: string;
  image?: string;
  youtube_id?: string;
  source: string;
  region: string;
  published_at: string;
  people?: string[];
}

interface Feed {
  for_you: BuzzItem[] | null;
  latest: BuzzItem[] | null;
  videos: BuzzItem[] | null;
  people: { name: string; kind: string; stories: number }[] | null;
  updated: string;
}

interface Upcoming {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
}

const REGIONS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "global", label: "Hollywood" },
  { key: "in", label: "Bollywood" },
  { key: "kr", label: "K-Drama" },
];

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const img = (p?: string, size = "w500") => (!p ? "" : p.startsWith("http") ? p : `https://image.tmdb.org/t/p/${size}${p}`);

function Thumb({ src, className, children }: { src?: string; className: string; children?: React.ReactNode }) {
  const [bad, setBad] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-white/[0.08] to-white/[0.02] ${className}`}>
      {src && !bad ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onError={() => setBad(true)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/20">
          <Newspaper className="h-8 w-8" />
        </div>
      )}
      {children}
    </div>
  );
}

function Shelf({ title, subtitle, children, action }: { title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mt-12">
      <div className="tv-gutter mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="tv-shelf-title !mb-0">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-white/50">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Entertainment news + videos for the viewer, with live updates. */
export default function BuzzHub() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [region, setRegion] = useState("");
  const [person, setPerson] = useState("");
  const [incoming, setIncoming] = useState<BuzzItem[]>([]);
  const [playing, setPlaying] = useState<BuzzItem | null>(null);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const latestRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (region) qs.set("region", region);
    if (person) qs.set("person", person);
    try {
      const r = await fetch(`${getApiUrl()}/api/buzz?${qs}`, { cache: "no-store" });
      setFeed(await r.json());
    } catch {
      setFeed((f) => f || { for_you: [], latest: [], videos: [], people: [], updated: "" });
    }
  }, [region, person]);

  useEffect(() => {
    load();
  }, [load]);

  // Live: new stories arrive over SSE; show a "new stories" pill.
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${getApiUrl()}/api/buzz/stream`);
      es.addEventListener("items", (e) => {
        try {
          const items: BuzzItem[] = JSON.parse((e as MessageEvent).data);
          setIncoming((cur) => [...items, ...cur].slice(0, 50));
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* SSE unsupported */
    }
    return () => es?.close();
  }, []);

  useEffect(() => {
    fetch(`${getApiUrl()}/api/tmdb/movie/upcoming?page=1`)
      .then((r) => r.json())
      .then((d) => {
        const list: Upcoming[] = (d.results || d.movies || d || []).filter((m: Upcoming) => m && m.title);
        const today = new Date().toISOString().slice(0, 10);
        setUpcoming(list.filter((m) => !m.release_date || m.release_date >= today).sort((a, b) => (a.release_date || "").localeCompare(b.release_date || "")).slice(0, 20));
      })
      .catch(() => {});
  }, []);

  const showIncoming = () => {
    setIncoming([]);
    load();
    latestRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const forYou = feed?.for_you || [];
  const videos = feed?.videos || [];
  const latest = feed?.latest || [];
  const people = useMemo(() => feed?.people || [], [feed]);
  const empty = feed && !forYou.length && !videos.length && !latest.length;

  const open = (it: BuzzItem) => {
    if (it.youtube_id) setPlaying(it);
    else window.open(it.url, "_blank", "noopener,noreferrer");
  };

  const peopleChips = useMemo(
    () =>
      people.length > 0 && (
        <div className="tv-gutter mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {person && (
            <button type="button" onClick={() => setPerson("")} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-black">
              {person} <X className="h-3.5 w-3.5" />
            </button>
          )}
          {people
            .filter((p) => p.name !== person)
            .map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setPerson(p.name)}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 py-1.5 text-[13px] font-semibold text-white/80 hover:bg-white/[0.14]"
              >
                <User className="h-3.5 w-3.5" /> {p.name} <span className="text-white/45">{p.stories}</span>
              </button>
            ))}
        </div>
      ),
    [people, person]
  );

  return (
    <div className="pb-24">
      {/* Live "new stories" pill */}
      <AnimatePresence>
        {incoming.length > 0 && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            onClick={showIncoming}
            className="fixed left-1/2 top-20 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-black shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
          >
            <ArrowUp className="h-4 w-4" /> {incoming.length} new {incoming.length === 1 ? "story" : "stories"}
          </motion.button>
        )}
      </AnimatePresence>

      {/* For you */}
      {forYou.length > 0 && (
        <Shelf
          title={
            <span className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-white/70" /> For You
            </span>
          }
          subtitle="News and trailers about the stars and filmmakers you watch"
        >
          {peopleChips}
          <div className="tv-shelf tv-gutter mt-4 gap-4">
            {forYou.map((it) => (
              <button key={it.id} type="button" onClick={() => open(it)} className="group w-[300px] shrink-0 text-left md:w-[360px]">
                <Thumb src={it.image} className="aspect-video rounded-[14px]">
                  {it.youtube_id && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur">
                        <Play className="ml-0.5 h-5 w-5 fill-current" />
                      </span>
                    </span>
                  )}
                  {it.people?.[0] && (
                    <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                      Because you watch {it.people[0]}
                    </span>
                  )}
                </Thumb>
                <p className="mt-2.5 line-clamp-2 text-[15px] font-semibold leading-snug text-white">{it.title}</p>
                <p className="mt-1 text-[12px] text-white/45">
                  {it.source} · {ago(it.published_at)}
                </p>
              </button>
            ))}
          </div>
        </Shelf>
      )}
      {forYou.length === 0 && peopleChips}

      {/* Videos */}
      {videos.length > 0 && (
        <Shelf title="Trailers & Videos" subtitle="From official studio and entertainment channels">
          <div className="tv-shelf tv-gutter gap-4">
            {videos.map((it) => (
              <button key={it.id} type="button" onClick={() => open(it)} className="group w-[260px] shrink-0 text-left md:w-[300px]">
                <Thumb src={it.image} className="aspect-video rounded-[14px]">
                  <span className="absolute inset-0 flex items-center justify-center opacity-90 transition-opacity group-hover:opacity-100">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur">
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    </span>
                  </span>
                </Thumb>
                <p className="mt-2.5 line-clamp-2 text-[14px] font-semibold leading-snug text-white">{it.title}</p>
                <p className="mt-1 text-[12px] text-white/45">
                  {it.source} · {ago(it.published_at)}
                </p>
              </button>
            ))}
          </div>
        </Shelf>
      )}

      {/* Coming soon */}
      {upcoming.length > 0 && (
        <Shelf title="Coming Soon" subtitle="Add one and HomeFlix downloads it when it's released">
          <div className="tv-shelf tv-gutter gap-4">
            {upcoming.map((m) => (
              <div key={m.id} className="w-[150px] shrink-0 md:w-[170px]">
                <a href={`/tmdb-movie/${m.id}?type=movie`} className="group block">
                  <Thumb src={img(m.poster_path, "w342")} className="aspect-[2/3] rounded-[14px]">
                    {m.release_date && (
                      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(m.release_date).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </Thumb>
                  <p className="mt-2 truncate text-[14px] font-semibold text-white">{m.title}</p>
                </a>
                <AutoDownloadButton
                  tmdbId={m.id}
                  mediaType="movie"
                  title={m.title}
                  year={m.release_date ? new Date(m.release_date).getFullYear() : undefined}
                  posterPath={m.poster_path}
                  className="mt-2 w-full justify-center !bg-white/[0.08] !py-1.5 !text-[12px] hover:!bg-white/[0.16]"
                />
              </div>
            ))}
          </div>
        </Shelf>
      )}

      {/* Latest */}
      <div ref={latestRef} className="scroll-mt-24" />
      <Shelf
        title="Latest News"
        subtitle={feed?.updated && !feed.updated.startsWith("0001") ? `Updated ${ago(feed.updated)}` : undefined}
        action={
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {REGIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRegion(r.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  region === r.key ? "bg-white text-black" : "bg-white/[0.08] text-white/70 hover:bg-white/[0.14]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      >
        {!feed ? (
          <div className="tv-gutter grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-[14px] bg-white/[0.05]" />
            ))}
          </div>
        ) : empty ? (
          <div className="tv-gutter">
            <div className="rounded-2xl bg-white/[0.04] px-6 py-12 text-center ring-1 ring-inset ring-white/[0.06]">
              <Newspaper className="mx-auto mb-3 h-8 w-8 text-white/30" />
              <p className="text-[15px] font-semibold text-white/80">No news yet</p>
              <p className="mt-1 text-[13px] text-white/50">HomeFlix checks film and TV news sites every 20 minutes.</p>
            </div>
          </div>
        ) : (
          <div className="tv-gutter grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {latest.map((it) => (
              <a key={it.id} href={it.url} target="_blank" rel="noopener noreferrer" className="group block">
                <Thumb src={it.image} className="aspect-video rounded-[14px]" />
                <p className="mt-2.5 line-clamp-2 text-[15px] font-semibold leading-snug text-white group-hover:underline">{it.title}</p>
                {it.summary && <p className="mt-1 line-clamp-2 text-[13px] text-white/55">{it.summary}</p>}
                <p className="mt-1.5 flex items-center gap-1 text-[12px] text-white/40">
                  {it.source} · {ago(it.published_at)} <ExternalLink className="h-3 w-3" />
                </p>
              </a>
            ))}
          </div>
        )}
      </Shelf>

      {/* Video player */}
      <AnimatePresence>
        {playing && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPlaying(null)}
          >
            <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-[17px] font-semibold text-white">{playing.title}</p>
                  <p className="text-[13px] text-white/50">{playing.source}</p>
                </div>
                <button type="button" onClick={() => setPlaying(null)} aria-label="Close video" className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="aspect-video overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${playing.youtube_id}?autoplay=1&rel=0&modestbranding=1`}
                  title={playing.title}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
