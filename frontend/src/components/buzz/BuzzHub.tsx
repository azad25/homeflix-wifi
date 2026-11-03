"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, ExternalLink, Film, Newspaper, Play, Sparkles, User, X } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import AutoDownloadButton from "@/components/autodl/AutoDownloadButton";
import { muteAllTrailers } from "@/lib/youtube";
import EventsPanel, { EventNotification } from "@/components/notifications/EventsPanel";

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

function Thumb({ src, className, children, icon }: { src?: string; className: string; children?: React.ReactNode; icon?: React.ReactNode }) {
  const [bad, setBad] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-white/[0.08] to-white/[0.02] ${className}`}>
      {src && !bad ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onError={() => setBad(true)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/20">
          {icon || <Newspaper className="h-8 w-8" />}
        </div>
      )}
      {children}
    </div>
  );
}

function Shelf({ id, title, subtitle, children, action }: { id: string; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section id={id} data-buzz-section className="scroll-mt-[132px] pt-12">
      <div className="tv-gutter mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-white md:text-[26px]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-white/50">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const PlayBadge = ({ big = false }: { big?: boolean }) => (
  <span className={`flex items-center justify-center rounded-full bg-white/90 text-black shadow-lg ${big ? "h-14 w-14" : "h-9 w-9"}`}>
    <Play className={`fill-current ${big ? "ml-1 h-6 w-6" : "ml-0.5 h-4 w-4"}`} />
  </span>
);

const Source = ({ it }: { it: BuzzItem }) => (
  <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-white/50">
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/15 text-[9px] font-bold uppercase text-white/80">{it.source.slice(0, 1)}</span>
    <span className="truncate">{it.source}</span>
    <span className="shrink-0 text-white/30">·</span>
    <span className="shrink-0">{ago(it.published_at)}</span>
  </span>
);

/** Big story with its headline over the artwork. */
function LeadCard({ it, onOpen, label }: { it: BuzzItem; onOpen: (it: BuzzItem) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onOpen(it)} className="group block w-full text-left">
      <Thumb src={it.image} className="aspect-video rounded-[20px] ring-1 ring-inset ring-white/[0.06]">
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
        {label && (
          <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5" /> {label}
          </span>
        )}
        {it.youtube_id && (
          <span className="absolute inset-0 flex items-center justify-center opacity-90 transition-transform group-hover:scale-105">
            <PlayBadge big />
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
          <p className="line-clamp-3 text-[20px] font-bold leading-tight tracking-[-0.01em] text-white md:text-[26px]">{it.title}</p>
          {it.summary && <p className="mt-1.5 line-clamp-2 max-w-2xl text-[14px] text-white/70">{it.summary}</p>}
          <div className="mt-2">
            <Source it={it} />
          </div>
        </div>
      </Thumb>
    </button>
  );
}

/** Thumbnail + headline row (side list). */
function CompactRow({ it, onOpen }: { it: BuzzItem; onOpen: (it: BuzzItem) => void }) {
  return (
    <button type="button" onClick={() => onOpen(it)} className="group flex w-full items-start gap-3.5 rounded-2xl p-2 text-left transition-colors hover:bg-white/[0.05]">
      <Thumb src={it.image} className="aspect-video w-[132px] shrink-0 rounded-xl md:w-[148px]">
        {it.youtube_id && (
          <span className="absolute inset-0 flex items-center justify-center">
            <PlayBadge />
          </span>
        )}
      </Thumb>
      <span className="min-w-0 flex-1 pt-0.5">
        {it.people?.[0] && <span className="mb-1 block truncate text-[11px] font-semibold uppercase tracking-wide text-white/45">{it.people[0]}</span>}
        <span className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-white">{it.title}</span>
        <span className="mt-1.5 block">
          <Source it={it} />
        </span>
      </span>
    </button>
  );
}

/** Sticky section tabs with scroll-spy. */
function SectionTabs({ tabs }: { tabs: { id: string; label: string }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const [stuck, setStuck] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // The section whose top has passed under the bars is the current one.
    const update = () => {
      let cur = tabs[0]?.id;
      for (const t of tabs) {
        const el = document.getElementById(t.id);
        if (el && el.getBoundingClientRect().top <= 150) cur = t.id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = tabs[tabs.length - 1]?.id;
      setActive(cur);
      setStuck(!!navRef.current && navRef.current.getBoundingClientRect().top <= 64.5);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [tabs]);
  if (tabs.length < 2) return null;
  return (
    <nav
      ref={navRef}
      aria-label="Sections"
      className={`sticky top-16 z-30 transition-colors duration-300 ${
        stuck
          ? "border-b border-white/[0.08] bg-black/90 backdrop-blur-2xl before:absolute before:inset-x-0 before:bottom-full before:h-16 before:bg-black/95 before:backdrop-blur-2xl"
          : "border-b border-transparent"
      }`}
    >
      <div className="tv-gutter flex gap-1.5 overflow-x-auto py-2.5 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={active === t.id ? "true" : undefined}
            onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className={`shrink-0 rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors ${
              active === t.id ? "bg-white text-black" : "text-white/65 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400e3);

/** Entertainment news + videos for the viewer, with live updates. */
export default function BuzzHub({ events = [] }: { events?: EventNotification[] }) {
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
    if (it.youtube_id) {
      muteAllTrailers(); // the live mosaic's trailers go quiet
      setPlaying(it);
    }
    else window.open(it.url, "_blank", "noopener,noreferrer");
  };

  const peopleChips = useMemo(
    () =>
      people.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
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

  const lead = forYou.length ? forYou : latest.slice(0, 5);
  const leadIsForYou = forYou.length > 0;
  const restLatest = leadIsForYou ? latest : latest.slice(5);
  const tabs = useMemo(
    () =>
      [
        { id: "buzz-top", label: leadIsForYou ? "For You" : "Top Stories", on: lead.length > 0 || events.length > 0 },
        { id: "buzz-videos", label: "Trailers", on: videos.length > 0 },
        { id: "buzz-soon", label: "Coming Soon", on: upcoming.length > 0 },
        { id: "buzz-news", label: "News", on: true },
      ].filter((t) => t.on),
    [leadIsForYou, lead.length, events.length, videos.length, upcoming.length]
  );

  return (
    <div className="pb-24">
      <SectionTabs tabs={tabs} />

      {/* Live "new stories" pill */}
      <AnimatePresence>
        {incoming.length > 0 && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            onClick={showIncoming}
            className="fixed left-1/2 top-[128px] z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#0a84ff] px-4 py-2 text-[14px] font-semibold text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
          >
            <ArrowUp className="h-4 w-4" /> {incoming.length} new {incoming.length === 1 ? "story" : "stories"}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Top: featured stories + server activity */}
      {(lead.length > 0 || events.length > 0) && (
        <section id="buzz-top" data-buzz-section className="tv-gutter scroll-mt-[132px] pt-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              {lead.length > 0 && (
                <>
                  <div className="mb-4">
                    <h2 className="flex items-center gap-2 text-[22px] font-bold tracking-[-0.02em] text-white md:text-[26px]">{leadIsForYou ? "For You" : "Top Stories"}</h2>
                    <p className="mt-0.5 text-[13px] text-white/50">{leadIsForYou ? "News and trailers about the stars and filmmakers you watch" : "The biggest film and TV stories right now"}</p>
                  </div>
                  {leadIsForYou && peopleChips}
                  <div className={`grid gap-5 ${lead.length > 1 ? "xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" : ""} ${leadIsForYou && people.length ? "mt-4" : ""}`}>
                    <LeadCard it={lead[0]} onOpen={open} label={lead[0].people?.[0] ? `Because you watch ${lead[0].people[0]}` : undefined} />
                    {lead.length > 1 && (
                      <div className="flex flex-col gap-1">
                        {lead.slice(1, 5).map((it) => (
                          <CompactRow key={it.id} it={it} onOpen={open} />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              {lead.length === 0 && peopleChips}
            </div>
            <div className="lg:pt-[68px]">
              <EventsPanel events={events} className="lg:sticky lg:top-[140px]" />
            </div>
          </div>
        </section>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <Shelf id="buzz-videos" title="Trailers & Videos" subtitle="From official studio and entertainment channels">
          <div className="tv-shelf tv-gutter gap-4">
            {videos.map((it) => (
              <button key={it.id} type="button" onClick={() => open(it)} className="group w-[280px] shrink-0 text-left md:w-[340px]">
                <Thumb src={it.image} className="aspect-video rounded-[16px] ring-1 ring-inset ring-white/[0.06]">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  <span className="absolute right-3 top-3 opacity-90 transition-transform group-hover:scale-110">
                    <PlayBadge />
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-white">{it.title}</p>
                    <p className="mt-1 truncate text-[12px] text-white/60">
                      {it.source} · {ago(it.published_at)}
                    </p>
                  </div>
                </Thumb>
              </button>
            ))}
          </div>
        </Shelf>
      )}

      {/* Coming soon */}
      {upcoming.length > 0 && (
        <Shelf id="buzz-soon" title="Coming Soon" subtitle="Tap ✦ and HomeFlix downloads it on release day">
          <div className="tv-shelf tv-gutter gap-4">
            {upcoming.map((m) => {
              const days = m.release_date ? daysUntil(m.release_date) : null;
              return (
                <div key={m.id} className="w-[150px] shrink-0 md:w-[176px]">
                  <a href={`/tmdb-movie/${m.id}?type=movie`} className="group block">
                    <Thumb src={img(m.poster_path, "w342")} icon={<Film className="h-8 w-8" />} className="aspect-[2/3] rounded-[16px] ring-1 ring-inset ring-white/[0.06]">
                      {days !== null && (
                        <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-xl">
                          {days <= 0 ? "Out now" : days === 1 ? "Tomorrow" : days < 60 ? `In ${days} days` : new Date(m.release_date!).toLocaleDateString([], { month: "short", year: "numeric" })}
                        </span>
                      )}
                      <span className="absolute bottom-2.5 right-2.5">
                        <AutoDownloadButton
                          compact
                          tmdbId={m.id}
                          mediaType="movie"
                          title={m.title}
                          year={m.release_date ? new Date(m.release_date).getFullYear() : undefined}
                          posterPath={m.poster_path}
                        />
                      </span>
                    </Thumb>
                    <p className="mt-2.5 truncate text-[14px] font-semibold text-white">{m.title}</p>
                    {m.release_date && (
                      <p className="mt-0.5 text-[12px] text-white/45">{new Date(m.release_date).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</p>
                    )}
                  </a>
                </div>
              );
            })}
          </div>
        </Shelf>
      )}

      {/* Latest */}
      <div ref={latestRef} />
      <Shelf
        id="buzz-news"
        title="Latest News"
        subtitle={feed?.updated && !feed.updated.startsWith("0001") ? `Updated ${ago(feed.updated)}` : undefined}
        action={
          <div role="radiogroup" aria-label="Region" className="flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-white/[0.08] p-0.5 [scrollbar-width:none]">
            {REGIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                role="radio"
                aria-checked={region === r.key}
                onClick={() => setRegion(r.key)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  region === r.key ? "bg-white text-black" : "text-white/70 hover:text-white"
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
              <div key={i} className="aspect-[4/3] animate-pulse rounded-[16px] bg-white/[0.05]" />
            ))}
          </div>
        ) : empty || restLatest.length === 0 ? (
          <div className="tv-gutter">
            <div className="rounded-[20px] bg-white/[0.04] px-6 py-12 text-center ring-1 ring-inset ring-white/[0.06]">
              <Newspaper className="mx-auto mb-3 h-8 w-8 text-white/30" />
              <p className="text-[15px] font-semibold text-white/80">{empty ? "No news yet" : "That's everything for now"}</p>
              <p className="mt-1 text-[13px] text-white/50">HomeFlix checks film and TV news sites every 20 minutes.</p>
            </div>
          </div>
        ) : (
          <div className="tv-gutter grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {restLatest.map((it) => (
              <a key={it.id} href={it.url} target="_blank" rel="noopener noreferrer" className="group block">
                <Thumb src={it.image} className="aspect-video rounded-[16px] ring-1 ring-inset ring-white/[0.06]">
                  <span className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/80 opacity-0 backdrop-blur-xl transition-opacity group-hover:opacity-100">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                </Thumb>
                <p className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug text-white">{it.title}</p>
                {it.summary && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-white/50">{it.summary}</p>}
                <div className="mt-2">
                  <Source it={it} />
                </div>
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
