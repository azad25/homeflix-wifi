"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import TVShelf from "./TVShelf";
import TVArtworkCard from "./TVArtworkCard";
import { apiCall, getApiUrl } from "@/lib/api";
import { mediaBackdropUrl, mediaLogoUrl } from "@/lib/mediaArt";

interface TasteItem {
  id: number;
  type: "movie" | "series";
  title: string;
  year?: number;
  rating?: number;
  genre_names?: string[];
  backdrop_path?: string;
  tmdb_backdrop_url?: string;
  logo_path?: string;
  tmdb_id?: number;
  reason?: string;
}

interface TasteRow {
  id: string;
  title: string;
  kind: string;
  items: TasteItem[];
}

interface TasteResult {
  personalized: boolean;
  signals: number;
  rows: TasteRow[];
}

const hrefFor = (it: TasteItem) => (it.type === "series" ? `/tv-series/${it.id}` : `/movie/${it.id}`);

const artFor = (it: TasteItem) => {
  if (it.type === "series") {
    return it.tmdb_backdrop_url || (it.backdrop_path?.startsWith("http") ? it.backdrop_path : `${getApiUrl()}/api/series/${it.id}/backdrop`);
  }
  return mediaBackdropUrl(it);
};

/**
 * Personalised home rows from /api/recommendations/for-you: Top Picks,
 * Because You Watched…, More with <actor>, Continue <collection>… Each card
 * shows why it was picked. Uses the cached apiCall, so revisits are instant.
 */
export default function ForYouShelves({ limit = 20 }: { limit?: number }) {
  const router = useRouter();
  const [data, setData] = useState<TasteResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiCall(`/api/recommendations/for-you?limit=${limit}`)
      .then((res: TasteResult) => {
        if (!cancelled && res && Array.isArray(res.rows)) setData(res);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (!data || data.rows.length === 0) return null;

  return (
    <div className="space-y-10 md:space-y-12">
      {data.rows.map((row, ri) => (
        <TVShelf
          key={row.id}
          title={
            row.kind === "top-picks" ? (
              <span className="flex items-center gap-2">
                {row.title}
                <Sparkles className="h-5 w-5 text-white/60" aria-hidden="true" />
              </span>
            ) : (
              row.title
            )
          }
          subtitle={ri === 0 && data.personalized ? "Based on what you watch, who's in it and who made it" : undefined}
        >
          {row.items.map((it, i) => (
            <TVArtworkCard
              key={`${it.type}-${it.id}`}
              title={it.title}
              image={artFor(it)}
              logo={it.type === "movie" ? mediaLogoUrl(it) : null}
              caption={it.reason || [it.year, it.genre_names?.[0]].filter(Boolean).join(" · ") || undefined}
              priority={ri === 0 && i < 4}
              onSelect={() => router.push(hrefFor(it))}
            />
          ))}
        </TVShelf>
      ))}
    </div>
  );
}
