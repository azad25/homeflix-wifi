"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Clapperboard, HardDrive, RefreshCw, Terminal } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useLog } from "../activity";
import { Badge, Button, Group, Notice, Row, Toggle } from "../ui";

interface Entry {
  tmdb_id: number;
  media_type: string;
  title: string;
  release_date: string;
  release_label?: string;
  rank: number;
  state: string;
  error?: string;
  popularity: number;
  star_power: number;
  video?: { bytes: number; height: number; duration: number };
}
interface Snap {
  movies: Entry[];
  series: Entry[];
  refreshed?: string;
  settings: { enabled: boolean; budget_bytes: number };
  used_bytes: number;
  working?: string;
  last_error?: string;
  ytdlp?: string;
  log?: string[];
}

const MB = 1024 ** 2;
const fmt = (b: number) => (b >= 1024 * MB ? `${(b / (1024 * MB)).toFixed(2)} GB` : b < 10 * MB ? `${(b / MB).toFixed(1)} MB` : `${Math.round(b / MB)} MB`);
const STATE: Record<string, { label: string; tone: "success" | "info" | "danger" | "neutral" }> = {
  ready: { label: "Ready", tone: "success" },
  pending: { label: "Queued", tone: "neutral" },
  downloading: { label: "Downloading", tone: "info" },
  encoding: { label: "Encoding", tone: "info" },
  failed: { label: "Failed", tone: "danger" },
  no_downloader: { label: "YouTube only", tone: "neutral" },
  over_budget: { label: "Over budget", tone: "danger" },
};
const BUDGETS = [512, 1024, 2048, 4096];

/** Settings > Auto Download: the Coming Soon trailer pipeline. */
export default function ComingSoonAdmin() {
  const log = useLog();
  const [s, setS] = useState<Snap | null>(null);
  const [gone, setGone] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/comingsoon`, { cache: "no-store" });
      if (!r.ok) return setGone(true);
      const d = await r.json();
      setS({ ...d, movies: d.movies || [], series: d.series || [], log: d.log || [] });
    } catch {
      setGone(true);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const busy = !!s && (!!s.working || [...s.movies, ...s.series].some((e) => e.state === "pending"));
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [busy, load]);

  const save = async (patch: Partial<Snap["settings"]>) => {
    if (!s) return;
    const next = { ...s.settings, ...patch };
    setS({ ...s, settings: next });
    const r = await fetch(`${getApiUrl()}/api/admin/comingsoon/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    const d = await r.json().catch(() => ({}));
    log(r.ok ? "✅ Coming Soon settings saved" : `❌ ${d.error || "Couldn't save"}`);
    load();
  };
  const refresh = async () => {
    await fetch(`${getApiUrl()}/api/admin/comingsoon/refresh`, { method: "POST" });
    log("🎬 Checking TMDB for new upcoming releases…");
    setTimeout(load, 4000);
  };

  if (gone) return null;
  if (!s) return <Group title="Coming Soon Trailers"><div className="px-5 py-4 text-[13px] text-white/45">Loading…</div></Group>;
  const all = [...s.movies, ...s.series];
  const ready = all.filter((e) => e.state === "ready").length;
  const pct = Math.min(100, (s.used_bytes / s.settings.budget_bytes) * 100);

  return (
    <div className="space-y-6">
      <Group
        title="Coming Soon Trailers"
        description="The 10 most anticipated upcoming movies and 10 series (this year and next), with trailers kept on the server for smooth playback on the web and TV."
        actions={
          <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={refresh}>
            Check Now
          </Button>
        }
        footer="Titles are picked from TMDB twice a day: US productions with a well-known cast and an official trailer, ranked by popularity. Released or dropped titles are removed with their trailer; Notify Me puts a title in the Auto Download queue for release day."
      >
        <Row icon={<Clapperboard />} title="Coming Soon" description={s.refreshed ? `${ready} of ${all.length} trailers ready · checked ${new Date(s.refreshed).toLocaleString()}` : "Not checked yet"}>
          <Toggle label="Coming Soon" checked={s.settings.enabled} onChange={(v) => save({ enabled: v })} />
        </Row>
        <div className="px-4 py-4 md:px-5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-2 text-white/75">
              <HardDrive className="h-4 w-4" /> Trailer space
            </span>
            <span className="flex items-center gap-2 tabular-nums text-white/55">
              {fmt(s.used_bytes)} of
              <select
                aria-label="Trailer space"
                value={s.settings.budget_bytes / MB}
                onChange={(e) => save({ budget_bytes: Number(e.target.value) * MB })}
                className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[13px] text-white outline-none"
              >
                {BUDGETS.map((b) => (
                  <option key={b} value={b} className="bg-zinc-900">
                    {fmt(b * MB)}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full ${pct > 97 ? "bg-danger" : "bg-white/70"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[12px] text-white/40">Each trailer gets an equal share and is re-encoded to fit it (1080p H.264, about {fmt(s.settings.budget_bytes / 20)} each).</p>
        </div>
        <Row icon={<Terminal />} title="Downloader" description={s.ytdlp ? `yt-dlp ${s.ytdlp}` : "yt-dlp isn't installed. Trailers play from YouTube until it is."}>
          {s.ytdlp ? <Badge tone="success">Ready</Badge> : <Badge tone="danger">Missing</Badge>}
        </Row>
      </Group>

      {!s.ytdlp && (
        <Notice tone="info" title="Install yt-dlp to keep trailers on the server">
          On the server run <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[12px] text-white">sudo apt install yt-dlp</span> or{" "}
          <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[12px] text-white">pipx install yt-dlp</span>, then press Check Now. Downloading from YouTube may go against YouTube&apos;s terms; it&apos;s used here for personal playback only.
        </Notice>
      )}
      {s.last_error && <Notice tone="danger" title="Couldn't check TMDB">{s.last_error}</Notice>}

      {all.length > 0 && (
        <Group title="Current Lineup">
          {[...s.movies, ...s.series].map((e) => {
            const st = STATE[e.state] || { label: e.state, tone: "neutral" as const };
            const working = s.working === `${e.media_type}-${e.tmdb_id}`;
            return (
              <Row
                key={`${e.media_type}-${e.tmdb_id}`}
                title={
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-right text-[12px] tabular-nums text-white/35">{e.rank}</span>
                    <span className="truncate">{e.title}</span>
                    <span className="text-[12px] text-white/40">{e.media_type === "tv" ? e.release_label || "Series" : "Movie"}</span>
                  </span>
                }
                description={
                  <span className="pl-7">
                    {new Date(e.release_date + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                    {e.video ? ` · ${e.video.height}p · ${fmt(e.video.bytes)}` : ""}
                    {e.error && e.state !== "ready" ? ` · ${e.error}` : ""}
                  </span>
                }
              >
                <Badge tone={working ? "info" : st.tone}>{working ? "Working…" : st.label}</Badge>
              </Row>
            );
          })}
        </Group>
      )}
    </div>
  );
}
