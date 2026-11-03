"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useNavigate } from "@/hooks/useNavigate";
import Navbar from "@/components/Navbar";
import VideoPlayer from "@/components/VideoPlayer";
import { apiCall, getApiUrl } from "@/lib/api";
import { Media } from "@/types/media";
import BackendWidgetRenderer from "@/components/widgets/BackendWidgetRenderer";
import ErrorBoundary from "@/components/ErrorBoundary";
import TVHero, { TVHeroSlide } from "@/components/tv/TVHero";
import TVShelf from "@/components/tv/TVShelf";
import TMDBShelf from "@/components/tv/TMDBShelf";
import ComingSoonShowcase from "@/components/comingsoon/ComingSoonShowcase";
import TVArtworkCard from "@/components/tv/TVArtworkCard";
import { TVGridSkeleton, TVPageHeader } from "@/components/tv/TVPage";
import { mediaYouTubeKey } from "@/lib/mediaArt";
import { fetchTrailerKey } from "@/lib/tmdbItem";
import { Tv } from "lucide-react";

interface Series {
  id: number;
  title: string;
  description?: string;
  year?: number;
  rating?: number;
  genre_names?: string[];
  total_seasons?: number;
  total_episodes?: number;
  network?: string;
  certification?: string;
  poster_path?: string;
  backdrop_path?: string;
  tmdb_poster_url?: string;
  tmdb_backdrop_url?: string;
  tmdb_trailer_url?: string;
  trailer_url?: string;
  logo_path?: string;
  tmdb_id?: number;
  created_at?: string;
}

interface RecentItem {
  media_id: number;
  last_watched_at?: string;
  progress_seconds: number;
  duration_seconds: number;
  media: Media & { series_title?: string };
}

const api = () => getApiUrl();
const posterOf = (s: Series) => s.tmdb_poster_url || `${api()}/api/series/${s.id}/poster`;
const backdropOf = (s: Series) => s.tmdb_backdrop_url || `${api()}/api/series/${s.id}/backdrop`;
const logoOf = (s: Series) => (s.logo_path ? `${api()}/api/series/${s.id}/logo` : null);
const seasonsLabel = (s: Series) =>
  s.total_seasons ? `${s.total_seasons} Season${s.total_seasons === 1 ? "" : "s"}` : null;

const byNewest = (a: Series, b: Series) =>
  new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime() || b.id - a.id;

export default function TVShowsPage() {
  usePageTitle("TV Shows");
  const navigate = useNavigate();
  const [series, setSeries] = useState<Series[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  // One request for the whole page. The previous version fetched every
  // series' seasons AND every season's episodes on load and every 5 minutes
  // (hundreds of requests) just to render posters; episodes are now looked
  // up only when you press Play. apiCall caches, so revisits are instant.
  useEffect(() => {
    let cancelled = false;
    apiCall("/api/series")
      .then((data: Series[]) => {
        if (!cancelled && Array.isArray(data)) setSeries(data);
      })
      .catch((e: unknown) => console.error("Failed to load TV series:", e))
      .finally(() => !cancelled && setLoading(false));

    fetch(`${api()}/api/playback/recently-watched?limit=20`, { headers: { "X-User-ID": "1" } })
      .then((r) => (r.ok ? r.json() : []))
      .then((items: RecentItem[]) => {
        if (cancelled || !Array.isArray(items)) return;
        // One entry per show: the most recently watched episode.
        const seen = new Set<number>();
        setRecent(
          items.filter((it) => {
            const m = it?.media;
            if (!m || m.type !== "episode") return false;
            const sid = m.series_id || m.id;
            if (seen.has(sid)) return false;
            seen.add(sid);
            return true;
          })
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const openSeries = useCallback((s: Series | number) => navigate.push(`/tv-series/${typeof s === "number" ? s : s.id}`), [navigate]);

  const play = useCallback((media: Media, at = 0) => {
    setSelectedMedia(media);
    setStartTime(at);
    setIsPlayerOpen(true);
  }, []);

  // First episode of the first season, looked up on demand.
  const playSeries = useCallback(
    async (s: Series) => {
      try {
        const seasons: any[] = await fetch(`${api()}/api/series/${s.id}/seasons`).then((r) => (r.ok ? r.json() : []));
        const first = [...(seasons || [])]
          .filter((x) => (x.season_number ?? 1) > 0)
          .sort((a, b) => (a.season_number ?? 0) - (b.season_number ?? 0))[0] || seasons?.[0];
        if (!first) return openSeries(s);
        const eps: any[] = await fetch(`${api()}/api/series/${s.id}/seasons/${first.season_number ?? first.id}/episodes`).then((r) =>
          r.ok ? r.json() : []
        );
        const ep = [...(eps || [])].sort((a, b) => (a.episode_number ?? 0) - (b.episode_number ?? 0))[0];
        if (!ep) return openSeries(s);
        play({ ...ep, type: "episode", series_id: s.id } as Media);
      } catch {
        openSeries(s);
      }
    },
    [openSeries, play]
  );

  const heroSlides = useMemo<TVHeroSlide[]>(() => {
    const pool = [...series]
      .filter((s) => s.tmdb_backdrop_url || s.backdrop_path)
      .sort((a, b) => byNewest(a, b) || (b.rating || 0) - (a.rating || 0))
      .slice(0, 8);
    return pool.map((s) => {
      const key = mediaYouTubeKey(s);
      return {
        id: `series-${s.id}`,
        title: s.title,
        overview: s.description,
        backdrop: backdropOf(s),
        logo: logoOf(s),
        meta: [s.year, ...(s.genre_names || []).slice(0, 2), seasonsLabel(s), s.certification],
        trailerKey: key,
        resolveTrailer: !key && s.tmdb_id ? () => fetchTrailerKey({ id: s.tmdb_id, media_type: "tv" }) : undefined,
        ...({ _series: s } as any),
      };
    });
  }, [series]);

  const shelves = useMemo(() => {
    const out: { title: string; items: Series[]; variant: "landscape" | "poster" }[] = [];
    if (!series.length) return out;
    out.push({ title: "Recently Added", items: [...series].sort(byNewest).slice(0, 20), variant: "landscape" });
    const rated = series.filter((s) => (s.rating || 0) > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (rated.length >= 4) out.push({ title: "Top Rated", items: rated.slice(0, 20), variant: "poster" });

    // Genre rows from the API's genre_names (the old page read series.genres,
    // which the API never sends, so its genre rows were always empty).
    const counts = new Map<string, number>();
    series.forEach((s) => (s.genre_names || []).forEach((g) => counts.set(g, (counts.get(g) || 0) + 1)));
    [...counts.entries()]
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .forEach(([g]) =>
        out.push({
          title: g,
          items: series.filter((s) => s.genre_names?.includes(g)).sort((a, b) => (b.rating || 0) - (a.rating || 0)),
          variant: "poster",
        })
      );
    return out;
  }, [series]);

  const allSorted = useMemo(() => [...series].sort((a, b) => a.title.localeCompare(b.title)), [series]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <Navbar />

      {loading ? (
        <div className="h-[72vh] min-h-[480px] w-full animate-pulse bg-gradient-to-b from-zinc-900 to-black md:h-[86vh]" />
      ) : heroSlides.length > 0 ? (
        <TVHero
          slides={heroSlides}
          onPrimary={(s) => playSeries((s as any)._series)}
          onSecondary={(s) => openSeries((s as any)._series)}
          primaryLabel="Play"
          secondaryLabel="Details"
        />
      ) : (
        <div className="h-24" />
      )}

      <main className="relative z-10 -mt-6 space-y-10 pb-24 md:-mt-10 md:space-y-12">
        {recent.length > 0 && (
          <TVShelf title="Continue Watching">
            {recent.map((it, i) => {
              const m = it.media as any;
              const left = Math.max(0, (it.duration_seconds || 0) - (it.progress_seconds || 0));
              const label = [
                m.season_number && m.episode_number ? `S${m.season_number}:E${m.episode_number}` : null,
                left > 60 ? `${Math.round(left / 60)} min left` : null,
              ].filter(Boolean).join(" · ");
              const sid = m.series_id || m.id;
              return (
                <TVArtworkCard
                  key={`cw-${it.media_id}`}
                  title={m.series_title || m.series?.title || m.title}
                  image={m.episode_still_path ? `${api()}/api/episode-stills/${m.id}` : `${api()}/api/series/${sid}/backdrop`}
                  caption={label || m.episode_title || undefined}
                  progress={it.duration_seconds ? it.progress_seconds / it.duration_seconds : undefined}
                  priority={i < 4}
                  onSelect={() => play(it.media, it.progress_seconds || 0)}
                />
              );
            })}
          </TVShelf>
        )}

        {/* Widgets configured for this page */}
        <ErrorBoundary>
          <BackendWidgetRenderer page="tv-shows" className="space-y-10 md:space-y-12" />
        </ErrorBoundary>

        {shelves.map((sh, si) => (
          <TVShelf key={sh.title} title={sh.title}>
            {sh.items.map((s, i) => (
              <TVArtworkCard
                key={`${sh.title}-${s.id}`}
                title={s.title}
                variant={sh.variant}
                image={sh.variant === "landscape" ? backdropOf(s) : posterOf(s)}
                logo={sh.variant === "landscape" ? logoOf(s) : null}
                caption={[s.year, seasonsLabel(s), s.rating ? `★ ${Number(s.rating).toFixed(1)}` : null].filter(Boolean).join(" · ") || undefined}
                priority={si === 0 && i < 4}
                onSelect={() => openSeries(s)}
              />
            ))}
          </TVShelf>
        ))}

        {/* Beyond the library: what's on TV right now (hover plays the trailer) */}
        <ErrorBoundary>
          <ComingSoonShowcase type="tv" />
        </ErrorBoundary>
        <TMDBShelf name="trending-tv" title="Trending Shows" subtitle="This week on TMDB" />
        <TMDBShelf name="on-the-air" />
        <TMDBShelf name="top-rated-tv" />

        {/* Full library */}
        <section className="tv-gutter pt-2">
          <TVPageHeader title="All Shows" subtitle={series.length ? `${series.length} series in your library` : undefined} className="mb-6" />
          {loading ? (
            <TVGridSkeleton count={12} />
          ) : allSorted.length === 0 ? (
            <div className="py-16 text-center">
              <Tv className="mx-auto h-10 w-10 text-white/30" />
              <p className="mt-3 text-lg font-semibold">No TV shows yet</p>
              <p className="tv-caption mt-1">Add series to your media folder and run a scan from Settings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
              {allSorted.map((s, i) => (
                <TVArtworkCard
                  key={`all-${s.id}`}
                  title={s.title}
                  variant="poster"
                  image={posterOf(s)}
                  caption={[s.year, seasonsLabel(s)].filter(Boolean).join(" · ") || undefined}
                  priority={i < 12}
                  onSelect={() => openSeries(s)}
                  className="!w-full !max-w-none"
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {selectedMedia && (
        <VideoPlayer
          media={selectedMedia}
          isOpen={isPlayerOpen}
          onClose={() => {
            setIsPlayerOpen(false);
            setSelectedMedia(null);
          }}
          startTime={startTime}
          onPlayNext={(next) => play(next, 0)}
        />
      )}
    </div>
  );
}
