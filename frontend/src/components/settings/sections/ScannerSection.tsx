"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ChevronDown, Eye, EyeOff, FolderOpen, Pause, Play, RefreshCw, ScanLine, Search, Trash2, Wand2, Zap } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useLog } from "../activity";
import { Badge, Button, EmptyState, Group, Row, SectionHeader } from "../ui";

interface Run {
  id: number;
  kind: string;
  status: "running" | "completed" | "failed";
  started_at: string;
  ended_at?: string;
  seconds: number;
  phase?: string;
  operation?: string;
  total: number;
  processed: number;
  errors: number;
  skipped: number;
  new: number;
  updated: number;
  workers: number;
  files_per_sec: number;
  error?: string;
  warnings: number;
  error_lines: number;
}
interface Ev {
  seq: number;
  at: string;
  level: "info" | "success" | "warn" | "error";
  text: string;
  run_id?: number;
}
interface Status {
  current: Run | null;
  history: Run[];
  last_scan?: string;
  workers?: number;
  batch_size?: number;
  media_paths?: string[];
  watcher?: { running: boolean; paths: string[] };
}
interface Bucket {
  label: string;
  count: number;
}
interface Issue {
  key: string;
  label: string;
  detail: string;
  count: number;
  tone: "danger" | "info";
  action: string;
  fix?: string;
  samples: { id: number; title: string; path?: string }[];
}
interface Analysis {
  generated_at: string;
  movies: number;
  series: number;
  seasons: number;
  episodes: number;
  bytes: number;
  hours: number;
  added_7d: number;
  added_30d: number;
  resolution: Bucket[];
  video_codecs: Bucket[];
  audio_codecs: Bucket[];
  containers: Bucket[];
  hdr: number;
  folders: { name: string; path: string; type: string; active: boolean; online: boolean; files: number; bytes: number; free: number; total: number }[];
  issues: Issue[];
  missing_checked: number;
}

const GB = 1024 ** 3;
const size = (b: number) => (b >= 1024 * GB ? `${(b / (1024 * GB)).toFixed(1)} TB` : b >= GB ? `${(b / GB).toFixed(1)} GB` : `${Math.round(b / 1024 ** 2)} MB`);
const dur = (s: number) => (s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`);
const ago = (iso?: string) => {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const ACTIONS: { key: string; label: string; path: string; desc: string; icon: React.ReactNode }[] = [
  { key: "incremental", label: "Quick Scan", path: "/api/admin/scan/incremental", desc: "New and changed files only", icon: <Search /> },
  { key: "full", label: "Full Scan", path: "/api/admin/scan/full", desc: "Every folder, every file", icon: <ScanLine /> },
  { key: "superfast", label: "Superfast", path: "/api/admin/scan/superfast", desc: "Names only, details later", icon: <Zap /> },
  { key: "sync", label: "Scan & Sync", path: "/api/admin/scan/sync", desc: "Scan, then match the database to disk", icon: <RefreshCw /> },
];

function Bars({ title, data, total }: { title: string; data: Bucket[]; total: number }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-white/45">{title}</p>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-3 text-[13px]">
            <span className="w-24 shrink-0 truncate text-white/75">{d.label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
              <span className={`block h-full rounded-full ${d.label === "unknown" || d.label === "Not probed" ? "bg-white/25" : "bg-white/75"}`} style={{ width: `${(d.count / max) * 100}%` }} />
            </span>
            <span className="w-20 shrink-0 text-right tabular-nums text-white/55">
              {d.count.toLocaleString()} <span className="text-white/30">{total ? `${Math.round((d.count / total) * 100)}%` : ""}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Settings > Scanner: what the media scanner is doing and what it found. */
export default function ScannerSection() {
  const log = useLog();
  const [status, setStatus] = useState<Status | null>(null);
  const [live, setLive] = useState<Run | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [filter, setFilter] = useState<"all" | "problems">("all");
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [runFilter, setRunFilter] = useState<number | null>(null);
  const termRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/scanner/status`, { cache: "no-store" });
      if (r.ok) {
        const d: Status = await r.json();
        setStatus({ ...d, history: d.history || [] });
        setLive(d.current);
      }
    } catch {
      /* offline */
    }
  }, []);
  const loadAnalysis = useCallback(async (fresh = false) => {
    setAnalysing(true);
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/scanner/analysis${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
      if (r.ok) setAnalysis(await r.json());
    } catch {
      /* offline */
    }
    setAnalysing(false);
  }, []);

  useEffect(() => {
    loadStatus();
    loadAnalysis();
    fetch(`${getApiUrl()}/api/admin/scanner/events?limit=400`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
      .catch(() => {});
  }, [loadStatus, loadAnalysis]);

  // Live: activity lines and run counters over SSE.
  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      es = new EventSource(`${getApiUrl()}/api/admin/scanner/stream`);
      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        es?.close();
        retry = setTimeout(connect, 4000);
      };
      es.addEventListener("event", (m) => {
        const e: Ev = JSON.parse((m as MessageEvent).data);
        setEvents((cur) => (cur.length && cur[cur.length - 1].seq >= e.seq ? cur : [...cur, e].slice(-1500)));
      });
      es.addEventListener("run", (m) => {
        const r: Run | null = JSON.parse((m as MessageEvent).data);
        setLive(r && r.status === "running" ? r : null);
        if (r && r.status !== "running") {
          loadStatus();
          loadAnalysis(true);
        }
      });
    };
    connect();
    return () => {
      es?.close();
      if (retry) clearTimeout(retry);
    };
  }, [loadStatus, loadAnalysis]);

  const shown = useMemo(
    () => events.filter((e) => (filter === "all" || e.level === "error" || e.level === "warn") && (runFilter === null || e.run_id === runFilter)),
    [events, filter, runFilter]
  );
  useEffect(() => {
    const el = termRef.current;
    if (el && !pausedRef.current) el.scrollTop = el.scrollHeight;
  }, [shown]);

  const start = async (a: (typeof ACTIONS)[number]) => {
    setBusy(a.key);
    try {
      const r = await fetch(`${getApiUrl()}${a.path}`, { method: "POST" });
      log(r.ok ? `🔍 ${a.label} started` : `❌ ${a.label} failed to start`);
      setTimeout(loadStatus, 800);
    } finally {
      setBusy(null);
    }
  };
  const fix = async (is: Issue) => {
    setBusy(is.key);
    try {
      const r = await fetch(`${getApiUrl()}${is.action}`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      log(r.ok ? `✅ ${is.fix}: ${d.message || "started"}` : `❌ ${is.fix} failed: ${d.error || r.statusText}`);
      setTimeout(() => loadAnalysis(true), 3000);
    } finally {
      setBusy(null);
    }
  };

  const run = live;
  const pct = run && run.total > 0 ? Math.min(100, (run.processed / run.total) * 100) : 0;
  const eta = run && run.files_per_sec > 0 && run.total > run.processed ? (run.total - run.processed) / run.files_per_sec : 0;
  const last = status?.history?.[0];
  const videos = analysis ? analysis.movies + analysis.episodes : 0;

  return (
    <div className="space-y-10">
      <SectionHeader
        title="Scanner"
        description="What the media scanner is doing right now, everything it logs, and what it found in your library."
        actions={
          <>
            <Button size="sm" icon={<Search />} onClick={() => start(ACTIONS[0])} loading={busy === "incremental"} disabled={!!run}>
              Quick Scan
            </Button>
            <Button size="sm" variant="primary" icon={<ScanLine />} onClick={() => start(ACTIONS[1])} loading={busy === "full"} disabled={!!run}>
              Full Scan
            </Button>
          </>
        }
      />

      {/* Status */}
      <Group
        title="Status"
        actions={
          <span className="flex items-center gap-1.5 text-[12px] text-white/50">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-white/30"}`} /> {connected ? "Live" : "Reconnecting…"}
          </span>
        }
      >
        {run ? (
          <div className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-info" />
                  </span>
                  <p className="text-[19px] font-semibold text-white">{run.kind}</p>
                  <Badge tone="info">Running</Badge>
                </div>
                <p className="mt-1 truncate text-[14px] text-white/70">{run.phase || "Working…"}</p>
                {run.operation && <p className="mt-0.5 truncate font-mono text-[12px] text-white/45">{run.operation}</p>}
              </div>
              <div className="text-right text-[13px] text-white/55">
                <p className="tabular-nums">{dur(run.seconds)} elapsed</p>
                {eta > 0 && <p className="tabular-nums">about {dur(eta)} left</p>}
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full rounded-full bg-white transition-[width] duration-700 ${run.total ? "" : "w-1/3 animate-pulse"}`} style={run.total ? { width: `${pct}%` } : undefined} />
            </div>
            <p className="mt-2 text-[12px] tabular-nums text-white/50">
              {run.total ? `${run.processed.toLocaleString()} of ${run.total.toLocaleString()} files · ${pct.toFixed(0)}%` : `${run.processed.toLocaleString()} files processed`}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {[
                ["Processed", run.processed],
                ["New", run.new],
                ["Updated", run.updated],
                ["Skipped", run.skipped],
                ["Errors", run.errors + run.error_lines],
                ["Files/s", run.files_per_sec.toFixed(1)],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-white/[0.05] px-3 py-2.5">
                  <p className="text-[11px] text-white/45">{k}</p>
                  <p className={`mt-0.5 text-[18px] font-semibold tabular-nums ${k === "Errors" && Number(v) > 0 ? "text-danger" : "text-white"}`}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <Row
              icon={<Activity />}
              title="Idle"
              description={
                last
                  ? `Last: ${last.kind} ${ago(last.ended_at)} · ${dur(last.seconds)} · ${last.processed.toLocaleString()} files${last.new ? ` · ${last.new} new` : ""}`
                  : status?.last_scan
                    ? `Last scan ${ago(status.last_scan)}`
                    : "No scans recorded yet"
              }
            >
              {last && <Badge tone={last.status === "failed" ? "danger" : "success"}>{last.status === "failed" ? "Last scan failed" : "Last scan OK"}</Badge>}
            </Row>
            <Row
              icon={status?.watcher?.running ? <Eye /> : <EyeOff />}
              title="Folder watcher"
              description={
                status?.watcher?.running
                  ? `Watching ${status.watcher.paths?.length || 0} folder${status.watcher.paths?.length === 1 ? "" : "s"}: new files are picked up automatically`
                  : "Off: new files are found on the next scan"
              }
            >
              <Badge tone={status?.watcher?.running ? "success" : "neutral"}>{status?.watcher?.running ? "On" : "Off"}</Badge>
            </Row>
          </>
        )}
        {!run && (
          <div className="grid grid-cols-2 gap-px bg-white/[0.07] md:grid-cols-4">
            {ACTIONS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => start(a)}
                disabled={busy !== null}
                className="flex items-start gap-3 bg-[#121214] p-4 text-left transition-colors hover:bg-white/[0.06] disabled:opacity-50 [&>svg]:mt-0.5 [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0 [&>svg]:text-white/70"
              >
                {a.icon}
                <span>
                  <span className="block text-[14px] font-semibold text-white">{a.label}</span>
                  <span className="block text-[12px] text-white/45">{a.desc}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Group>

      {/* Activity terminal */}
      <Group
        title="Live Activity"
        description="The scanner's lines from the server log, as they happen."
        actions={
          <div className="flex items-center gap-1.5">
            <div role="radiogroup" aria-label="Activity filter" className="inline-flex rounded-full bg-white/[0.08] p-0.5">
              {(["all", "problems"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={filter === f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-[12px] font-semibold ${filter === f ? "bg-white text-black" : "text-white/65 hover:text-white"}`}
                >
                  {f === "all" ? "All" : "Problems"}
                </button>
              ))}
            </div>
            <Button size="sm" variant="ghost" icon={paused ? <Play /> : <Pause />} onClick={() => setPaused((p) => !p)} aria-label={paused ? "Follow" : "Pause"}>
              {paused ? "Follow" : "Pause"}
            </Button>
            <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => setEvents([])} aria-label="Clear view" />
          </div>
        }
      >
        {runFilter !== null && (
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2 text-[12px] text-white/60 md:px-5">
            <span>Showing run #{runFilter} only</span>
            <button type="button" onClick={() => setRunFilter(null)} className="font-semibold text-white hover:underline">
              Show everything
            </button>
          </div>
        )}
        <div
          ref={termRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
            if (!atBottom && !paused) setPaused(true);
          }}
          className="h-[360px] overflow-y-auto bg-[#0a0a0b] px-4 py-3 font-mono text-[12.5px] leading-[1.65] md:px-5"
        >
          {shown.length === 0 ? (
            <p className="py-10 text-center font-sans text-[13px] text-white/35">{filter === "all" ? "Nothing yet. Start a scan, or add a file to a watched folder." : "No warnings or errors."}</p>
          ) : (
            shown.map((e) => (
              <div key={e.seq} className="flex gap-3 whitespace-pre-wrap break-words">
                <span className="shrink-0 select-none text-white/25">{time(e.at)}</span>
                <span
                  className={
                    e.level === "error" ? "text-danger" : e.level === "warn" ? "text-danger/75" : e.level === "success" ? "text-success" : e.text.startsWith("▶") || e.text.startsWith("📍") ? "font-semibold text-white" : "text-white/75"
                  }
                >
                  {e.text}
                </span>
              </div>
            ))
          )}
        </div>
      </Group>

      {/* Analysis */}
      <Group
        title="Library Analysis"
        description={analysis ? `Updated ${ago(analysis.generated_at)}` : undefined}
        actions={
          <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => loadAnalysis(true)} loading={analysing}>
            Analyse
          </Button>
        }
        padded
      >
        {!analysis ? (
          <p className="text-[13px] text-white/45">Analysing…</p>
        ) : (
          <div className="space-y-7">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {[
                ["Movies", analysis.movies.toLocaleString()],
                ["Shows", `${analysis.series.toLocaleString()}`, `${analysis.episodes.toLocaleString()} episodes`],
                ["Library size", size(analysis.bytes)],
                ["Watch time", `${Math.round(analysis.hours).toLocaleString()} h`],
                ["Added", `${analysis.added_7d}`, `this week · ${analysis.added_30d} this month`],
              ].map(([k, v, sub]) => (
                <div key={k} className="rounded-xl bg-white/[0.05] px-4 py-3">
                  <p className="text-[12px] text-white/45">{k}</p>
                  <p className="mt-1 text-[22px] font-bold tabular-nums tracking-[-0.02em] text-white">{v}</p>
                  {sub && <p className="text-[11px] text-white/40">{sub}</p>}
                </div>
              ))}
            </div>
            <div className="grid gap-7 md:grid-cols-2">
              <Bars title="Resolution" data={analysis.resolution} total={videos} />
              <Bars title="Video codec" data={analysis.video_codecs} total={videos} />
              <Bars title="Audio codec" data={analysis.audio_codecs} total={videos} />
              <Bars title="Container" data={analysis.containers} total={videos} />
            </div>
            {analysis.hdr > 0 && <p className="text-[12px] text-white/45">{analysis.hdr.toLocaleString()} titles are HDR or Dolby Vision.</p>}
          </div>
        )}
      </Group>

      {analysis && analysis.folders.length > 0 && (
        <Group title="Folders">
          {analysis.folders.map((f) => (
            <Row
              key={f.path}
              icon={<FolderOpen />}
              title={
                <span className="flex items-center gap-2">
                  {f.name} {!f.active && <Badge>Off</Badge>}
                </span>
              }
              description={<span className="font-mono text-[12px]">{f.path}</span>}
            >
              <span className="text-right text-[12px] tabular-nums text-white/55">
                {f.files.toLocaleString()} files · {size(f.bytes)}
                {f.online && f.total ? <span className="block text-white/35">{size(f.free)} free</span> : null}
              </span>
              <Badge tone={f.online ? "success" : "danger"}>{f.online ? "Online" : "Offline"}</Badge>
            </Row>
          ))}
        </Group>
      )}

      {/* Health */}
      {analysis && (
        <Group
          title="Health Checks"
          description={analysis.issues.length ? `${analysis.issues.length} thing${analysis.issues.length > 1 ? "s" : ""} to look at` : undefined}
          footer={analysis.missing_checked ? `${analysis.missing_checked.toLocaleString()} files checked on disk (offline folders skipped).` : undefined}
        >
          {analysis.issues.length === 0 ? (
            <EmptyState title="All good" description="Every title is matched, analysed and on disk." />
          ) : (
            analysis.issues.map((is) => (
              <div key={is.key}>
                <div className="flex items-center gap-3 px-4 py-3.5 md:px-5">
                  <button type="button" onClick={() => setOpen(open === is.key ? null : is.key)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={open === is.key}>
                    <span className={`flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-[13px] font-bold tabular-nums ${is.tone === "danger" ? "bg-danger/15 text-danger" : "bg-info/15 text-info"}`}>
                      {is.count > 999 ? "999+" : is.count}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] text-white">{is.label}</span>
                      <span className="block text-[13px] text-white/50">{is.detail}</span>
                    </span>
                    <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-white/40 transition-transform ${open === is.key ? "rotate-180" : ""}`} />
                  </button>
                  {is.action && (
                    <Button size="sm" icon={<Wand2 />} onClick={() => fix(is)} loading={busy === is.key}>
                      {is.fix}
                    </Button>
                  )}
                </div>
                {open === is.key && is.samples.length > 0 && (
                  <ul className="mx-4 mb-3 space-y-1 rounded-xl bg-white/[0.04] p-3 md:mx-5">
                    {is.samples.map((s, i) => (
                      <li key={`${s.id}-${i}`} className="min-w-0 text-[13px]">
                        <span className="text-white/85">{s.title}</span>
                        {s.path && <span className="block truncate font-mono text-[11px] text-white/35">{s.path}</span>}
                      </li>
                    ))}
                    {is.count > is.samples.length && <li className="text-[12px] text-white/40">and {(is.count - is.samples.length).toLocaleString()} more</li>}
                  </ul>
                )}
              </div>
            ))
          )}
        </Group>
      )}

      {/* History */}
      <Group title="Scan History" footer="The last 30 runs, from every trigger: these buttons, the folder watcher, finished downloads and startup.">
        {!status || status.history.length === 0 ? (
          <EmptyState title="No scans yet" description="Runs show up here with their timing and results." />
        ) : (
          status.history.map((h) => (
            <Row
              key={h.id}
              onClick={() => setRunFilter(h.id)}
              title={
                <span className="flex items-center gap-2">
                  {h.kind}
                  <span className="text-[12px] text-white/35">#{h.id}</span>
                </span>
              }
              description={`${new Date(h.started_at).toLocaleString()} · ${dur(h.seconds)} · ${h.processed.toLocaleString()}${h.total ? ` of ${h.total.toLocaleString()}` : ""} files${h.new ? ` · ${h.new} new` : ""}${h.errors + h.error_lines ? ` · ${h.errors + h.error_lines} errors` : ""}${h.error ? ` · ${h.error}` : ""}`}
            >
              <Badge tone={h.status === "failed" ? "danger" : h.errors + h.error_lines > 0 ? "info" : "success"}>{h.status === "failed" ? "Failed" : h.errors + h.error_lines > 0 ? "With errors" : "OK"}</Badge>
            </Row>
          ))
        )}
      </Group>
    </div>
  );
}
