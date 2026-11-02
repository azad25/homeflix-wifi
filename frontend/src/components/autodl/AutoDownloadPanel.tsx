"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Trash2, RotateCcw, CheckCircle2, Clock, AlertTriangle, Loader2, Library, Settings2, Plus } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useNavigate } from "@/hooks/useNavigate";

export interface QueueItem {
  id: number;
  tmdb_id: number;
  media_type: "movie" | "tv";
  season: number;
  title: string;
  year: number;
  poster_path: string;
  status: "queued" | "waiting" | "downloading" | "completed" | "in_library" | "failed";
  message: string;
  release_name: string;
  release_quality: string;
  release_source: string;
  release_size: number;
  release_seeders: number;
  progress: number;
  created_at: string;
}

/** A My List title that isn't in the library yet. */
export interface Wanted {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  year?: number;
  poster_path?: string;
}

const PROFILE_LABEL: Record<string, string> = {
  compact: "Compact HD (≤3 GB)",
  fullhd: "Full HD",
  uhd: "4K",
  saver: "Data saver",
  custom: "Custom",
};

const poster = (p?: string) => (!p ? "" : p.startsWith("http") ? p : `https://image.tmdb.org/t/p/w185${p.startsWith("/") ? "" : "/"}${p}`);
const gb = (b: number) => `${(b / 1024 ** 3).toFixed(1)} GB`;

const STATUS: Record<QueueItem["status"], { label: string; tone: string; icon: React.ReactNode }> = {
  queued: { label: "Queued", tone: "text-white/60", icon: <Clock className="h-3.5 w-3.5" /> },
  waiting: { label: "Waiting", tone: "text-[#ffd84d]", icon: <Clock className="h-3.5 w-3.5" /> },
  downloading: { label: "Downloading", tone: "text-[#5eadff]", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  completed: { label: "Ready to watch", tone: "text-[#5be07f]", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  in_library: { label: "In your library", tone: "text-[#5be07f]", icon: <Library className="h-3.5 w-3.5" /> },
  failed: { label: "Failed", tone: "text-[#ff7b73]", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

export default function AutoDownloadPanel({ wanted }: { wanted: Wanted[] }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [seasonPick, setSeasonPick] = useState<{ w: Wanted; seasons: number; chosen: number[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiUrl()}/api/autodownload`, { cache: "no-store" });
      const d = await r.json();
      setItems(d.items || []);
      setSettings(d.settings);
    } catch {
      setItems((i) => i || []);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  const queued = useMemo(() => new Set((items || []).map((i) => `${i.media_type}-${i.tmdb_id}`)), [items]);
  const notQueued = wanted.filter((w) => !queued.has(`${w.media_type}-${w.tmdb_id}`));

  const add = async (w: Wanted, seasons?: number[]) => {
    setBusy(`${w.media_type}-${w.tmdb_id}`);
    try {
      await fetch(`${getApiUrl()}/api/autodownload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...w, seasons }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const addTV = async (w: Wanted) => {
    // Ask which seasons: look up how many the show has.
    let seasons = 1;
    try {
      const r = await fetch(`${getApiUrl()}/api/tmdb-movie/${w.tmdb_id}?type=tv`);
      const d = await r.json();
      seasons = (d.data || d).number_of_seasons || 1;
    } catch {
      /* default to one season */
    }
    if (seasons <= 1) return add(w, [1]);
    setSeasonPick({ w, seasons, chosen: Array.from({ length: seasons }, (_, i) => i + 1) });
  };

  const addAll = async () => {
    setBusy("all");
    for (const w of notQueued) {
      // Shows from "download all" start with their first season.
      await fetch(`${getApiUrl()}/api/autodownload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...w, seasons: w.media_type === "tv" ? [1] : undefined }),
      }).catch(() => null);
    }
    await load();
    setBusy(null);
  };

  const act = async (path: string, method: string) => {
    await fetch(`${getApiUrl()}/api/autodownload${path}`, { method }).catch(() => null);
    load();
  };

  const active = (items || []).filter((i) => ["queued", "waiting", "downloading"].includes(i.status));
  const done = (items || []).filter((i) => !["queued", "waiting", "downloading"].includes(i.status));

  return (
    <div className="space-y-10">
      {/* Summary */}
      <div className="flex flex-col gap-4 rounded-2xl bg-white/[0.045] p-5 ring-1 ring-inset ring-white/[0.07] md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold text-white">Auto Download</p>
          <p className="mt-0.5 text-[13px] text-white/55">
            Add titles and HomeFlix finds a good release, waits for free space and downloads it in the background.
            {settings && (
              <>
                {" "}
                Profile: <span className="text-white/80">{PROFILE_LABEL[settings.profile] || settings.profile}</span>
                {!settings.enabled && <span className="text-[#ffd84d]"> · paused</span>}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => act("/run", "POST")} className="tv-btn tv-btn-secondary h-10 px-4 text-[14px]">
            <RefreshCw className="h-4 w-4" /> Check Now
          </button>
          <button type="button" onClick={() => navigate.push("/settings?tab=autodownload")} className="tv-btn tv-btn-secondary h-10 px-4 text-[14px]">
            <Settings2 className="h-4 w-4" /> Quality Settings
          </button>
        </div>
      </div>

      {/* From My List */}
      {notQueued.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-semibold text-white">Not in Your Library Yet</h2>
              <p className="text-[13px] text-white/50">From My List</p>
            </div>
            <button type="button" onClick={addAll} disabled={busy === "all"} className="tv-btn tv-btn-primary h-10 px-4 text-[14px]">
              {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download All ({notQueued.length})
            </button>
          </div>
          <div className="tv-shelf -mx-1 gap-3 px-1 pb-2">
            {notQueued.map((w) => {
              const key = `${w.media_type}-${w.tmdb_id}`;
              return (
                <div key={key} className="w-[132px] shrink-0">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/[0.06]">
                    {w.poster_path && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={poster(w.poster_path)} alt="" className="h-full w-full object-cover" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />
                    )}
                    <button
                      type="button"
                      onClick={() => (w.media_type === "tv" ? addTV(w) : add(w))}
                      disabled={busy === key}
                      aria-label={`Download ${w.title}`}
                      className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform hover:scale-110"
                    >
                      {busy === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-2 truncate text-[13px] font-medium text-white/85">{w.title}</p>
                  <p className="text-[12px] text-white/40">{w.media_type === "tv" ? "Series" : w.year || "Movie"}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Season picker */}
      {seasonPick && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={() => setSeasonPick(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#1c1c1e] p-5 ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
            <p className="text-[17px] font-semibold text-white">{seasonPick.w.title}</p>
            <p className="mb-4 text-[13px] text-white/55">Which seasons should HomeFlix download?</p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: seasonPick.seasons }, (_, i) => i + 1).map((n) => {
                const on = seasonPick.chosen.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSeasonPick({ ...seasonPick, chosen: on ? seasonPick.chosen.filter((x) => x !== n) : [...seasonPick.chosen, n].sort((a, b) => a - b) })}
                    className={`h-9 rounded-full px-3.5 text-[13px] font-semibold ${on ? "bg-white text-black" : "bg-white/[0.08] text-white/70"}`}
                  >
                    Season {n}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSeasonPick(null)} className="tv-btn tv-btn-secondary h-10 px-4 text-[14px]">
                Cancel
              </button>
              <button
                type="button"
                disabled={!seasonPick.chosen.length}
                onClick={() => {
                  add(seasonPick.w, seasonPick.chosen);
                  setSeasonPick(null);
                }}
                className="tv-btn tv-btn-primary h-10 px-4 text-[14px]"
              >
                Download {seasonPick.chosen.length} season{seasonPick.chosen.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Queue */}
      <section>
        <h2 className="mb-3 text-[19px] font-semibold text-white">Download Queue</h2>
        {items === null ? (
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
        ) : active.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.03] px-6 py-10 text-center text-[14px] text-white/50 ring-1 ring-inset ring-white/[0.06]">
            Nothing waiting. Add titles from My List above, or with the download button on a movie or show.
          </div>
        ) : (
          <QueueList items={active} onRemove={(id) => act(`/${id}`, "DELETE")} onRetry={(id) => act(`/${id}/retry`, "POST")} />
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-[19px] font-semibold text-white">History</h2>
          <QueueList items={done} onRemove={(id) => act(`/${id}`, "DELETE")} onRetry={(id) => act(`/${id}/retry`, "POST")} />
        </section>
      )}
    </div>
  );
}

function QueueList({ items, onRemove, onRetry }: { items: QueueItem[]; onRemove: (id: number) => void; onRetry: (id: number) => void }) {
  return (
    <div className="divide-y divide-white/[0.07] overflow-hidden rounded-2xl bg-white/[0.045] ring-1 ring-inset ring-white/[0.07]">
      {items.map((it) => {
        const st = STATUS[it.status] || STATUS.queued;
        return (
          <div key={it.id} className="flex items-center gap-4 p-3 md:p-4">
            <div className="h-[72px] w-12 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
              {it.poster_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster(it.poster_path)} alt="" className="h-full w-full object-cover" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-white">
                {it.title}
                {it.media_type === "tv" ? <span className="text-white/50"> · Season {it.season}</span> : it.year ? <span className="text-white/50"> ({it.year})</span> : null}
              </p>
              <p className={`mt-0.5 flex items-center gap-1.5 text-[13px] ${st.tone}`}>
                {st.icon}
                {st.label}
                {it.status === "downloading" && <span className="tabular-nums text-white/60">· {it.progress.toFixed(0)}%</span>}
              </p>
              {it.release_name && (
                <p className="mt-0.5 truncate text-[12px] text-white/40">
                  {[it.release_quality, it.release_source?.toUpperCase(), it.release_size ? gb(it.release_size) : "", it.release_seeders ? `${it.release_seeders} seeders` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {it.message && it.status !== "completed" && <p className="mt-0.5 text-[12px] text-white/50">{it.message}</p>}
              {it.status === "downloading" && (
                <div className="mt-2 h-1 max-w-sm overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${Math.min(100, it.progress)}%` }} />
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {(it.status === "failed" || it.status === "waiting") && (
                <button type="button" onClick={() => onRetry(it.id)} aria-label="Try again now" title="Try again now" className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => onRemove(it.id)} aria-label="Remove from queue" title={it.status === "downloading" ? "Remove from queue (the download keeps running in Downloads)" : "Remove"} className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
