"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import TVHero, { TVHeroSlide } from "./TVHero";
import { resolveMediaRoute } from "@/lib/mediaNavigation";
import { mediaBackdropUrl, mediaLogoUrl, mediaMeta, mediaYouTubeKey } from "@/lib/mediaArt";
import { fetchTrailerKey } from "@/lib/tmdbItem";
import type { Media } from "@/types/media";

interface TVMediaHeroProps {
  media: Media[];
  autoScroll?: boolean;
  /** seconds */
  scrollInterval?: number;
  showLogo?: boolean;
  showDescription?: boolean;
  previews?: boolean;
  maxSlides?: number;
}

/** Featured-banner widget rendered as an Apple TV hero for library media. */
export default function TVMediaHero({
  media,
  autoScroll = true,
  scrollInterval = 8,
  showLogo = true,
  showDescription = true,
  previews = true,
  maxSlides = 10,
}: TVMediaHeroProps) {
  const router = useRouter();

  const slides = useMemo<TVHeroSlide[]>(
    () =>
      (media || []).slice(0, maxSlides).map((m: any) => {
        const key = mediaYouTubeKey(m);
        const isTv = m.type === "tv" || m.type === "series" || m.type === "episode";
        return {
          id: `${m.type}-${m.id}`,
          title: m.title,
          overview: showDescription ? m.description || m.overview : undefined,
          backdrop: mediaBackdropUrl(m),
          logo: showLogo ? mediaLogoUrl(m) : null,
          meta: mediaMeta(m),
          trailerKey: key,
          resolveTrailer: !key && m.tmdb_id ? () => fetchTrailerKey({ id: m.tmdb_id, media_type: isTv ? "tv" : "movie" }) : undefined,
          ...({ _route: resolveMediaRoute(m) } as any),
        };
      }),
    [media, maxSlides, showLogo, showDescription]
  );

  if (!slides.length) return null;

  const open = (s: TVHeroSlide) => router.push((s as any)._route);

  return (
    <TVHero
      slides={slides}
      interval={autoScroll ? Math.max(4, scrollInterval) * 1000 : 24 * 3600 * 1000}
      previews={previews}
      primaryLabel="Play"
      secondaryLabel="Details"
      onPrimary={open}
      onSecondary={open}
    />
  );
}
