"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Info, RotateCcw, Tv } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiCall } from "@/lib/api";
import TVHero, { TVHeroSlide } from "@/components/tv/TVHero";
import TVShelf from "@/components/tv/TVShelf";
import ProviderShelfCard from "@/components/providers/ProviderShelfCard";
import { fetchTrailerKey, itemGenres, itemKey, itemTitle, itemYear, tmdbDetailHref, tmdbImage } from "@/lib/tmdbItem";

interface ShowcaseProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  primary_color: string;
  secondary_color: string;
}

interface ShowcaseItem {
  provider: ShowcaseProvider;
  content: any[];
}

const HERO_SLIDES = 8;

function ProviderLogo({ provider, size = 28 }: { provider: ShowcaseProvider; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[22%] bg-white/10"
      style={{ width: size, height: size }}
    >
      {provider.logo_path ? (
        <img src={provider.logo_path} alt="" className="h-full w-full object-cover" />
      ) : (
        <Tv className="h-1/2 w-1/2 text-white/60" />
      )}
    </span>
  );
}

export default function ProvidersPage() {
  const router = useRouter();
  const [showcase, setShowcase] = useState<ShowcaseItem[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const res = await apiCall("/api/providers/showcase");
        if (cancelled) return;
        const list: ShowcaseItem[] = (res?.showcase || []).filter((s: ShowcaseItem) => s?.provider);
        setShowcase(list);
      } catch (e) {
        console.error("Failed to load provider showcase:", e);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    fetchCollections();
    return () => {
      cancelled = true;
    };
  }, [fetchCollections, reload]);

  // Round-robin across providers (deterministic - the old random sort
  // reshuffled the hero whenever data refreshed).
  const heroSlides = useMemo<TVHeroSlide[]>(() => {
    const queues = showcase.map((s) => ({ p: s.provider, items: (s.content || []).filter((c) => c?.backdrop_path) }));
    const out: TVHeroSlide[] = [];
    const seen = new Set<string>();
    for (let round = 0; out.length < HERO_SLIDES && queues.some((q) => q.items.length > round); round++) {
      for (const q of queues) {
        const item = q.items[round];
        if (!item || seen.has(itemKey(item))) continue;
        seen.add(itemKey(item));
        out.push({
          id: itemKey(item),
          title: itemTitle(item),
          overview: item.overview,
          backdrop: tmdbImage(item.backdrop_path, "original").replace("/w1280/", "/original/"),
          meta: [itemYear(item), ...itemGenres(item, 2), item.vote_average ? `★ ${Number(item.vote_average).toFixed(1)}` : null],
          eyebrow: (
            <span className="tv-glass inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13px] font-semibold">
              <ProviderLogo provider={q.p} size={22} />
              {q.p.provider_name}
            </span>
          ),
          resolveTrailer: () => fetchTrailerKey(item),
          // keep the raw item for navigation
          ...({ _item: item } as any),
        });
        if (out.length >= HERO_SLIDES) break;
      }
    }
    return out;
  }, [showcase]);

  const openItem = (item: any) => router.push(tmdbDetailHref(item));
  const openProvider = (id: number) => router.push(`/providers/${id}`);

  return (
    <div className="min-h-screen overflow-x-hidden text-white">
      <Navbar />

      {loading ? (
        <div className="h-[72vh] min-h-[480px] w-full animate-pulse bg-gradient-to-b from-zinc-900 to-black md:h-[86vh]" />
      ) : heroSlides.length > 0 ? (
        <TVHero
          slides={heroSlides}
          primaryLabel="Details"
          primaryIcon={<Info className="h-[18px] w-[18px]" />}
          onPrimary={(s) => openItem((s as any)._item)}
        />
      ) : (
        <div className="h-28" />
      )}

      <main className="relative z-10 -mt-6 space-y-10 pb-24 md:-mt-10 md:space-y-12">
        {error && !loading && (
          <div className="tv-gutter">
            <div className="tv-glass flex flex-col items-start gap-4 rounded-2xl p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-semibold">Couldn&apos;t load streaming services</p>
                <p className="tv-caption mt-1">Check your connection and TMDB API key, then try again.</p>
              </div>
              <button className="tv-btn tv-btn-primary" onClick={() => setReload((r) => r + 1)}>
                <RotateCcw className="h-4 w-4" /> Retry
              </button>
            </div>
          </div>
        )}

        {/* Channels row */}
        {showcase.length > 0 && (
          <TVShelf title="Channels" subtitle="Browse everything on your streaming services">
            {showcase.map(({ provider }) => (
              <button
                key={provider.provider_id}
                type="button"
                onClick={() => openProvider(provider.provider_id)}
                className="tv-card-group w-[42vw] max-w-[220px] text-left outline-none sm:w-[200px] lg:w-[220px]"
                aria-label={`Open ${provider.provider_name}`}
              >
                <div
                  className="tv-card flex aspect-video items-center justify-center"
                  style={{
                    background: `radial-gradient(120% 120% at 30% 20%, ${provider.primary_color || "#3a3a3c"}cc, ${
                      provider.secondary_color || "#111"
                    } 85%)`,
                  }}
                >
                  <ProviderLogo provider={provider} size={64} />
                </div>
                <p className="mt-3 truncate text-[15px] font-semibold">{provider.provider_name}</p>
              </button>
            ))}
          </TVShelf>
        )}

        {/* One shelf per provider */}
        {showcase.map(({ provider, content }, i) =>
          content?.length ? (
            <TVShelf
              key={provider.provider_id}
              title={
                <span className="flex items-center gap-3">
                  <ProviderLogo provider={provider} size={30} />
                  Top on {provider.provider_name}
                </span>
              }
              action={
                <button
                  type="button"
                  onClick={() => openProvider(provider.provider_id)}
                  className="tv-focus flex shrink-0 items-center gap-0.5 rounded-lg px-1 text-[15px] font-medium text-white/60 transition-colors hover:text-white"
                >
                  See All <ChevronRight className="h-4 w-4" />
                </button>
              }
            >
              {content.map((item, idx) => (
                <ProviderShelfCard
                  key={itemKey(item)}
                  item={item}
                  onSelect={openItem}
                  collections={collections}
                  onDataRefresh={fetchCollections}
                  priority={i < 2 && idx < 4}
                />
              ))}
            </TVShelf>
          ) : null
        )}

        {!loading && !error && showcase.length === 0 && (
          <div className="tv-gutter pt-10 text-center">
            <Tv className="mx-auto h-10 w-10 text-white/30" />
            <p className="mt-3 text-lg font-semibold">No streaming services yet</p>
            <p className="tv-caption mt-1">Provider content appears here once TMDB is configured.</p>
          </div>
        )}
      </main>
    </div>
  );
}
