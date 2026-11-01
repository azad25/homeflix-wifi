"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import TVShelf from "./TVShelf";
import TVArtworkCard from "./TVArtworkCard";
import { resolveMediaRoute } from "@/lib/mediaNavigation";
import { mediaBackdropUrl, mediaLogoUrl, mediaPosterUrl } from "@/lib/mediaArt";
import type { Media } from "@/types/media";

interface TVMediaShelfProps {
  title?: string;
  subtitle?: string;
  media: Media[];
  maxItems?: number;
  variant?: "landscape" | "poster";
  /** Keep only items with this genre (case-insensitive). */
  genre?: string;
  showRating?: boolean;
  className?: string;
}

/** Apple TV shelf for library/widget Media items. */
export default function TVMediaShelf({
  title,
  subtitle,
  media,
  maxItems,
  variant = "landscape",
  genre,
  showRating = false,
  className,
}: TVMediaShelfProps) {
  const router = useRouter();

  const items = useMemo(() => {
    let list = media || [];
    if (genre) {
      const g = genre.toLowerCase();
      list = list.filter((m: any) =>
        [...(m.genre_names || []), ...((m.genres || []).map((x: any) => x?.name))]
          .filter(Boolean)
          .some((n: string) => n.toLowerCase() === g)
      );
    }
    // Movie and series rows share numeric ids; key by type as well.
    const seen = new Set<string>();
    list = list.filter((m: any) => {
      const k = `${m.type}-${m.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return maxItems && maxItems > 0 ? list.slice(0, maxItems) : list;
  }, [media, genre, maxItems]);

  if (!items.length) return null;

  return (
    <TVShelf title={title} subtitle={subtitle} className={className}>
      {items.map((m: any, i) => {
        const caption = [m.year || null, (m.genre_names || [])[0], showRating && m.rating ? `★ ${Number(m.rating).toFixed(1)}` : null]
          .filter(Boolean)
          .join(" · ");
        const href = resolveMediaRoute(m);
        return (
          <TVArtworkCard
            key={`${m.type}-${m.id}`}
            title={m.title}
            variant={variant}
            image={variant === "poster" ? mediaPosterUrl(m) : mediaBackdropUrl(m)}
            logo={variant === "landscape" ? mediaLogoUrl(m) : null}
            caption={caption || undefined}
            priority={i < 4}
            onSelect={() => router.push(href)}
          />
        );
      })}
    </TVShelf>
  );
}
