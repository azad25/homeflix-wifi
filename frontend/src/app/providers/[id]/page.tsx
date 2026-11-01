"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Info, RotateCcw } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiCall } from "@/lib/api";
import TVHero, { TVHeroSlide } from "@/components/tv/TVHero";
import TVShelf from "@/components/tv/TVShelf";
import ProviderShelfCard from "@/components/providers/ProviderShelfCard";
import { fetchTrailerKey, itemGenres, itemKey, itemTitle, itemType, itemYear, tmdbDetailHref, tmdbImage } from "@/lib/tmdbItem";

interface ProviderData {
  provider: { id: number; name: string; logo_url: string; primary_color: string; secondary_color: string };
  movies: any[];
  tv_shows: any[];
  regions?: string[];
}

type Filter = "all" | "movie" | "tv";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "movie", label: "Movies" },
  { key: "tv", label: "TV Shows" },
];

// Rows from /content don't carry media_type; stamp it so TV shows don't
// open as movies (the old page defaulted everything to type=movie).
const stamp = (items: any[] | undefined, type: "movie" | "tv") =>
  (items || []).map((i) => ({ ...i, media_type: i.media_type || type }));

const dedupe = (items: any[]) => {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = itemKey(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export default function ProviderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params?.id as string | undefined;

  const [data, setData] = useState<ProviderData | null>(null);
  const [extra, setExtra] = useState<{ trending: any[]; popular: any[]; fresh: any[] }>({ trending: [], popular: [], fresh: [] });
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [reload, setReload] = useState(0);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await apiCall("/api/collections");
      if (Array.isArray(res)) setCollections(res);
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    if (!providerId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    setExtra({ trending: [], popular: [], fresh: [] });
    (async () => {
      try {
        const res = await apiCall(`/api/providers/${providerId}/content`);
        if (cancelled) return;
        if (!res?.provider) throw new Error("not found");
        setData({ ...res, movies: stamp(res.movies, "movie"), tv_shows: stamp(res.tv_shows, "tv") });
      } catch (e) {
        console.error("Failed to load provider:", e);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
      // Secondary shelves load in the background; each one may fail alone.
      const [trending, popular, fresh] = await Promise.all(
        ["trending", "popular", "new"].map((k) =>
          apiCall(`/api/providers/${providerId}/${k}`).then((r: any) => r?.results || []).catch(() => [])
        )
      );
      if (!cancelled) setExtra({ trending, popular, fresh });
    })();
    fetchCollections();
    return () => {
      cancelled = true;
    };
  }, [providerId, reload, fetchCollections]);

  const byFilter = useCallback(
    (items: any[]) => (filter === "all" ? items : items.filter((i) => itemType(i) === filter)),
    [filter]
  );

  const heroSlides = useMemo<TVHeroSlide[]>(() => {
    if (!data) return [];
    const pool = byFilter(dedupe([...extra.trending, ...data.movies.slice(0, 4), ...data.tv_shows.slice(0, 4)]))
      .filter((i) => i.backdrop_path)
      .slice(0, 8);
    return pool.map((item) => ({
      id: itemKey(item),
      title: itemTitle(item),
      overview: item.overview,
      backdrop: tmdbImage(item.backdrop_path).replace("/w1280/", "/original/"),
      meta: [itemYear(item), itemType(item) === "tv" ? "TV Show" : "Movie", ...itemGenres(item, 2)],
      resolveTrailer: () => fetchTrailerKey(item),
      ...({ _item: item } as any),
    }));
  }, [data, extra.trending, byFilter]);

  const openItem = (item: any) => router.push(tmdbDetailHref(item));

  if (!loading && (error || !data)) {
    return (
      <div className="min-h-screen text-white">
        <Navbar />
        <div className="tv-gutter flex min-h-[70vh] flex-col items-center justify-center text-center">
          <h1 className="text-3xl font-bold tracking-tight">Channel unavailable</h1>
          <p className="tv-caption mt-2">We couldn&apos;t load this streaming service right now.</p>
          <div className="mt-6 flex gap-3">
            <button className="tv-btn tv-btn-primary" onClick={() => setReload((r) => r + 1)}>
              <RotateCcw className="h-4 w-4" /> Try Again
            </button>
            <button className="tv-btn tv-btn-secondary" onClick={() => router.push("/providers")}>
              All Channels
            </button>
          </div>
        </div>
      </div>
    );
  }

  const provider = data?.provider;
  const shelves: { title: string; items: any[] }[] = data
    ? [
        { title: "New Releases", items: byFilter(extra.fresh) },
        { title: `Trending on ${provider!.name}`, items: byFilter(extra.trending) },
        { title: "Popular", items: byFilter(extra.popular) },
        { title: "Movies", items: filter === "tv" ? [] : data.movies },
        { title: "TV Shows", items: filter === "movie" ? [] : data.tv_shows },
      ].map((s) => ({ ...s, items: dedupe(s.items) }))
    : [];

  return (
    <div className="min-h-screen overflow-x-hidden text-white">
      <Navbar />

      {loading || !data ? (
        <div className="h-[72vh] min-h-[480px] w-full animate-pulse bg-gradient-to-b from-zinc-900 to-black md:h-[86vh]" />
      ) : (
        <TVHero
          key={filter}
          slides={heroSlides}
          primaryLabel="Details"
          primaryIcon={<Info className="h-[18px] w-[18px]" />}
          onPrimary={(s) => openItem((s as any)._item)}
          topSlot={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/providers")}
                className="tv-glass tv-focus flex h-10 items-center gap-1 rounded-full pl-2 pr-4 text-sm font-semibold"
              >
                <ChevronLeft className="h-5 w-5" /> Channels
              </button>
              <span className="tv-glass flex h-10 items-center gap-2 rounded-full pl-1.5 pr-4 text-sm font-semibold">
                {provider?.logo_url && (
                  <img src={provider.logo_url} alt="" className="h-7 w-7 rounded-[22%] object-cover" />
                )}
                {provider?.name}
              </span>
            </div>
          }
        />
      )}

      {data && (
        <main className="relative z-10 pb-24">
          {/* Segmented control */}
          <div className="sticky top-16 z-30 flex justify-center py-4 md:top-20">
            <div role="tablist" className="tv-glass flex rounded-full p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`tv-focus rounded-full px-5 py-1.5 text-sm font-semibold transition-colors duration-200 ${
                    filter === f.key ? "bg-white text-black" : "text-white/70 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-10 md:space-y-12">
            {shelves.map((s, si) =>
              s.items.length ? (
                <TVShelf key={s.title} title={s.title}>
                  {s.items.map((item, idx) => (
                    <ProviderShelfCard
                      key={itemKey(item)}
                      item={item}
                      onSelect={openItem}
                      collections={collections}
                      onDataRefresh={fetchCollections}
                      priority={si === 0 && idx < 4}
                    />
                  ))}
                </TVShelf>
              ) : null
            )}
            {shelves.every((s) => s.items.length === 0) && (
              <p className="tv-gutter tv-caption py-10 text-center">Nothing to show for this filter yet.</p>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
