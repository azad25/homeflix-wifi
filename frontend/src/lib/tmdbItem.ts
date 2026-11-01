// Helpers for TMDB-shaped items coming from the backend (discover results,
// provider rows, trending lists...). Movies carry `title`/`release_date`,
// TV shows carry `name`/`first_air_date`; `media_type` is often missing.

export type TmdbMediaType = "movie" | "tv";

export const itemType = (item: any): TmdbMediaType => {
  const t = item?.media_type || item?.type;
  if (t === "tv" || t === "series") return "tv";
  if (t === "movie") return "movie";
  // Discover results don't always include media_type: infer from fields.
  return item?.name && !item?.title ? "tv" : item?.first_air_date && !item?.release_date ? "tv" : "movie";
};

export const itemTitle = (item: any): string => item?.title || item?.name || "Untitled";

export const itemYear = (item: any): number | null => {
  const d = item?.release_date || item?.first_air_date;
  const y = d ? new Date(d).getFullYear() : NaN;
  return Number.isFinite(y) ? y : null;
};

/** Stable React key: TMDB movie and TV ids overlap. */
export const itemKey = (item: any): string => `${itemType(item)}-${item?.id}`;

export const tmdbImage = (path?: string | null, size = "w1280"): string => {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/.test(path) || path.startsWith("/api/")) return path;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith("/") ? "" : "/"}${path}`;
};

export const tmdbDetailHref = (item: any): string => `/tmdb-movie/${item.id}?type=${itemType(item)}`;

export const TMDB_GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics",
};

export const itemGenres = (item: any, max = 2): string[] =>
  (item?.genre_ids || []).map((id: number) => TMDB_GENRES[id]).filter(Boolean).slice(0, max);

/** Fetch the best YouTube trailer key for a TMDB item via the backend. */
const trailerCache = new Map<string, Promise<string | null>>();
const TRAILER_SS_PREFIX = "hfx-trailer:";

export function fetchTrailerKey(item: any, apiBase = ""): Promise<string | null> {
  const fromUrl = (url?: string) => url?.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)?.[1] || null;
  const direct = fromUrl(item?.trailer_url);
  if (direct) return Promise.resolve(direct);
  const cacheKey = `${itemType(item)}-${item?.id}`;
  const hit = trailerCache.get(cacheKey);
  if (hit) return hit;
  try {
    const stored = typeof window !== "undefined" ? window.sessionStorage.getItem(TRAILER_SS_PREFIX + cacheKey) : null;
    if (stored !== null) {
      const p = Promise.resolve(stored || null);
      trailerCache.set(cacheKey, p);
      return p;
    }
  } catch {
    /* storage unavailable */
  }
  const p = lookupTrailerKey(item, apiBase).then((key) => {
    try {
      window.sessionStorage.setItem(TRAILER_SS_PREFIX + cacheKey, key || "");
    } catch {
      /* ignore */
    }
    return key;
  });
  trailerCache.set(cacheKey, p);
  return p;
}

async function lookupTrailerKey(item: any, apiBase: string): Promise<string | null> {
  const fromUrl = (url?: string) => url?.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)?.[1] || null;
  try {
    const res = await fetch(`${apiBase}/api/tmdb-movie/${item.id}?type=${itemType(item)}`);
    if (!res.ok) return null;
    const json = await res.json();
    // The endpoint wraps details as { media_type, data: {...} }.
    const videos: any[] = json?.data?.videos?.results || json?.videos?.results || [];
    const rank: Record<string, number> = { Trailer: 0, Teaser: 1, Clip: 2 };
    const best = videos
      .filter((v) => v?.site === "YouTube" && v.key && v.type in rank)
      .sort((a, b) => rank[a.type] - rank[b.type] || Number(!!b.official) - Number(!!a.official))[0];
    return best?.key || fromUrl(json?.data?.trailer_url) || null;
  } catch {
    return null;
  }
}
