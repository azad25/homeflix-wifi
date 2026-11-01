// Artwork URL resolution for library (and mixed TMDB) Media items, shared by
// the Apple TV shelves/hero. Mirrors the rules the older widgets used.
import { getApiUrl } from "@/lib/api";

type AnyMedia = Record<string, any>;

const resolvePath = (p: string | undefined | null, apiUrl: string, folder: string): string | null => {
  if (!p) return null;
  if (/^(https?:|data:|blob:)/.test(p)) return p;
  if (p.startsWith("/api/")) return `${apiUrl}${p}`;
  // Bare TMDB paths look like "/abc123.jpg"
  if (/^\/[A-Za-z0-9]+\.(jpg|jpeg|png|webp|svg)$/i.test(p)) return `https://image.tmdb.org/t/p/w1280${p}`;
  return `${apiUrl}/api/${folder}/${p.split("/").pop()}`;
};

export const mediaBackdropUrl = (m: AnyMedia): string => {
  const apiUrl = getApiUrl();
  return (
    m.tmdb_backdrop_url ||
    resolvePath(m.banner_path, apiUrl, "admin/assets") ||
    resolvePath(m.backdrop_path, apiUrl, "backdrops") ||
    `${apiUrl}/api/thumbnails/${m.id}`
  );
};

export const mediaPosterUrl = (m: AnyMedia): string => {
  const apiUrl = getApiUrl();
  if (m.tmdb_poster_url) return m.tmdb_poster_url.startsWith("/api/") ? `${apiUrl}${m.tmdb_poster_url}` : m.tmdb_poster_url;
  if (m.type === "series" && m.id) return `${apiUrl}/api/series/${m.id}/poster`;
  return `${apiUrl}/api/posters/${m.id}`;
};

export const mediaLogoUrl = (m: AnyMedia): string | null => {
  if (!m.logo_path) return null;
  const apiUrl = getApiUrl();
  if (m.tmdb_id && m.logo_path.startsWith("/") && !m.logo_path.startsWith("/api/")) {
    return `https://image.tmdb.org/t/p/w500${m.logo_path}`;
  }
  return resolvePath(m.logo_path, apiUrl, "logos");
};

export const mediaYouTubeKey = (m: AnyMedia): string | null => {
  const url: string | undefined = m.tmdb_trailer_url || m.trailer_url;
  return url?.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1] || null;
};

export const mediaMeta = (m: AnyMedia): string[] => {
  const out: string[] = [];
  if (m.year) out.push(String(m.year));
  const genres: string[] = m.genre_names?.length ? m.genre_names : (m.genres || []).map((g: any) => g?.name).filter(Boolean);
  out.push(...genres.slice(0, 2));
  if (m.certification) out.push(m.certification);
  if (m.duration > 0) {
    const mins = Math.round(m.duration / 60);
    out.push(mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`);
  }
  return out;
};
