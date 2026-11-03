"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Film, Sparkles, Trash2, RefreshCw, Gauge, FolderOpen, ScanLine } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useLog } from "../activity";
import { Badge, Button, Group, Notice, Row, Toggle, inputClass } from "../ui";

interface Settings {
  location: string;
  budget_gb: number;
  scan_generate: boolean;
}

interface Usage {
  previews: {
    bytes: number;
    files: number;
    missing: number;
    titles: number;
    roots: { path: string; bytes: number; files: number; free: number; total: number }[];
    next_location?: string;
  };
  caches: { kind: string; label: string; path: string; bytes: number; files: number }[];
  settings: Settings;
  queue: { interactive: number; background: number; running: string[] };
  counters: { generated: number; failed: number; joined: number; avg_seconds: number; last_error?: string };
  last_cleanup: null | { at: string; orphans: number; evicted: number; other_files: number; orphan_bytes: number; evicted_bytes: number; other_bytes: number; adopted: number };
}

const BUDGETS = [5, 10, 15, 25, 50, 0];

export function fmtBytes(b: number) {
  if (!b) return "0 MB";
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(b >= 10 * 1024 ** 3 ? 0 : 1)} GB`;
  return `${Math.max(1, Math.round(b / 1024 ** 2))} MB`;
}

function normalize(d: any): Usage | null {
  if (!d || !d.previews) return null;
  return {
    ...d,
    previews: { ...d.previews, roots: d.previews.roots || [] },
    caches: d.caches || [],
    queue: { interactive: 0, background: 0, ...(d.queue || {}), running: d.queue?.running || [] },
    counters: d.counters || { generated: 0, failed: 0, joined: 0, avg_seconds: 0 },
    settings: { location: "auto", budget_gb: 15, scan_generate: true, ...(d.settings || {}) },
  };
}

/** Settings > Storage: preview clips and other generated files. */
export default function PreviewStorage() {
  const log = useLog();
  const [u, setU] = useState<Usage | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [folder, setFolder] = useState("");
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/storage/assets`, { cache: "no-store" });
      if (!r.ok) {
        setUnavailable(true);
        return;
      }
      const d = normalize(await r.json());
      setU(d);
      if (d && d.settings.location !== "auto") {
        setFolder(d.settings.location);
        setPicking(true);
      }
    } catch {
      setUnavailable(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh while clips are being made.
  const working = !!u && (u.queue.running.length > 0 || u.queue.background > 0 || u.queue.interactive > 0);
  useEffect(() => {
    if (!working) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [working, load]);

  const save = async (patch: Partial<Settings>) => {
    if (!u) return;
    const next = { ...u.settings, ...patch };
    setU({ ...u, settings: next });
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/storage/assets/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const d = await r.json().catch(() => ({}));
      log(r.ok ? `✅ ${d.message || "Saved"}` : `❌ ${d.error || "Couldn't save"}`);
    } catch (e) {
      log(`❌ Couldn't save: ${e}`);
    }
    load();
  };

  const post = async (path: string, label: string) => {
    setBusy(path);
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/storage/assets/${path}`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) log(`❌ ${label} failed: ${d.error || r.statusText}`);
      else if (path === "cleanup") {
        const rep = d.report || {};
        log(`🧹 Cleanup freed ${fmtBytes(d.freed || 0)} (${rep.orphans || 0} unused, ${rep.evicted || 0} over budget, ${rep.other_files || 0} stale files; ${rep.adopted || 0} re-linked)`);
      } else log(`✅ ${d.message || label}`);
    } catch (e) {
      log(`❌ ${label} failed: ${e}`);
    }
    setBusy(null);
    load();
  };

  if (unavailable) return null;
  if (!u) return <Group title="Previews & Cache"><div className="px-5 py-4 text-[13px] text-white/45">Loading…</div></Group>;

  const s = u.settings;
  const budget = s.budget_gb * 1024 ** 3;
  const pct = budget > 0 ? Math.min(100, (u.previews.bytes / budget) * 100) : 0;
  const have = Math.max(0, u.previews.titles - u.previews.missing);
  const otherTotal = u.caches.reduce((a, c) => a + c.bytes, 0);
  const queued = u.queue.background + u.queue.interactive;

  return (
    <div className="space-y-6">
      <Group
        title="Previews & Cache"
        description="Short clips that play when you hover a title, plus thumbnails, artwork and streaming cache."
        actions={
          <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={load}>
            Refresh
          </Button>
        }
        footer="Clips are 12-second 720p cuts from a lively scene (HDR is converted so it isn't washed out). A title without one gets it the first time someone points at it; that request jumps ahead of library scans."
      >
        <div className="grid grid-cols-2 gap-px bg-white/[0.07] md:grid-cols-4">
          {[
            { label: "Preview clips", value: fmtBytes(u.previews.bytes), sub: `${u.previews.files} files` },
            { label: "Titles with a clip", value: `${have}`, sub: `of ${u.previews.titles}` },
            { label: "Other cache", value: fmtBytes(otherTotal), sub: `${u.caches.length} folders` },
            {
              label: "Making clips",
              value: u.queue.running.length ? "Now" : queued ? `${queued}` : "Idle",
              sub: u.counters.generated ? `${u.counters.generated} made · ~${u.counters.avg_seconds.toFixed(0)}s each` : "nothing yet this session",
            },
          ].map((x) => (
            <div key={x.label} className="bg-[#141416] p-4 md:p-5">
              <p className="text-[12px] text-white/50">{x.label}</p>
              <p className="mt-1.5 text-[22px] font-bold leading-none tracking-[-0.02em] text-white tabular-nums">{x.value}</p>
              <p className="mt-1.5 truncate text-[11px] text-white/40">{x.sub}</p>
            </div>
          ))}
        </div>

        {budget > 0 && (
          <div className="px-4 py-4 md:px-5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-white/70">Preview budget</span>
              <span className="tabular-nums text-white/50">
                {fmtBytes(u.previews.bytes)} of {s.budget_gb} GB
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full rounded-full ${pct > 95 ? "bg-danger" : "bg-white/70"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[12px] text-white/40">When full, clips of the titles nobody has looked at for the longest are removed; they're re-made on the next hover.</p>
          </div>
        )}

        {u.queue.running.length > 0 && (
          <Row icon={<Sparkles />} title={`Making: ${u.queue.running.join(", ")}`} description={queued ? `${queued} more waiting` : undefined} />
        )}
      </Group>

      <Group title="Preview Settings">
        <Row icon={<Gauge />} title="Space for previews" description="Older clips are removed to stay under this.">
          <select
            aria-label="Space for previews"
            className="rounded-lg bg-white/[0.08] px-2.5 py-1.5 text-[14px] text-white outline-none"
            value={s.budget_gb}
            onChange={(e) => save({ budget_gb: parseInt(e.target.value) })}
          >
            {BUDGETS.map((b) => (
              <option key={b} value={b} className="bg-zinc-900">
                {b ? `${b} GB` : "No limit"}
              </option>
            ))}
          </select>
        </Row>
        <Row
          icon={<ScanLine />}
          title="Make previews during scans"
          description={s.scan_generate ? "New titles get a clip right after they're added." : "Clips are only made when someone hovers a title (saves space and CPU)."}
        >
          <Toggle label="Make previews during scans" checked={s.scan_generate} onChange={(v) => save({ scan_generate: v })} />
        </Row>
        <div className="px-4 py-4 md:px-5">
          <div className="flex items-start gap-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white/[0.08] text-white/80 [&>svg]:h-[18px] [&>svg]:w-[18px]">
              <FolderOpen />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] text-white">Where clips are stored</p>
              <p className="mt-0.5 text-[13px] text-white/55">
                {s.location === "auto"
                  ? "Automatic: the server's own drive while it has room, otherwise the library drive with the most free space (never cloud drives)."
                  : "A folder you chose. If it fills up or goes missing, HomeFlix falls back to Automatic."}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="inline-flex self-start rounded-full bg-white/[0.08] p-0.5" role="radiogroup" aria-label="Clip location">
                  {(["auto", "folder"] as const).map((m) => {
                    const on = m === "auto" ? !picking : picking;
                    return (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          if (m === "auto") {
                            setPicking(false);
                            setFolder("");
                            if (s.location !== "auto") save({ location: "auto" });
                          } else setPicking(true);
                        }}
                        className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${on ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
                      >
                        {m === "auto" ? "Automatic" : "Choose folder"}
                      </button>
                    );
                  })}
                </div>
                {picking && (
                  <div className="flex min-w-0 flex-1 gap-2">
                    <input
                      className={`${inputClass} min-w-0 flex-1`}
                      value={folder}
                      onChange={(e) => setFolder(e.target.value)}
                      placeholder="/mnt/media/.homeflix-previews"
                      aria-label="Preview folder"
                    />
                    <Button size="sm" onClick={() => save({ location: folder })} disabled={!folder.startsWith("/") || folder === s.location}>
                      Use
                    </Button>
                  </div>
                )}
              </div>
              {u.previews.next_location && <p className="mt-2 truncate font-mono text-[12px] text-white/40">New clips go to {u.previews.next_location}</p>}
            </div>
          </div>
        </div>
      </Group>

      {u.previews.roots.length > 0 && (
        <Group title="Where Previews Are">
          {u.previews.roots.map((r) => (
            <Row
              key={r.path}
              icon={<Film />}
              title={<span className="font-mono text-[13px]">{r.path}</span>}
              description={`${r.files} clips · ${fmtBytes(r.bytes)}${r.total ? ` · ${fmtBytes(r.free)} free on this drive` : ""}`}
            >
              {r.total > 0 && r.free < 5 * 1024 ** 3 && <Badge tone="danger">Low space</Badge>}
            </Row>
          ))}
        </Group>
      )}

      {u.caches.length > 0 && (
        <Group title="Other Generated Files" footer="Thumbnails and extracted audio of titles that were removed from the library are deleted by the cleanup. The streaming cache empties itself.">
          {u.caches.map((c) => (
            <Row key={c.path} title={c.label} description={<span className="font-mono text-[12px]">{c.path}</span>}>
              <span className="text-[13px] tabular-nums text-white/60">{fmtBytes(c.bytes)}</span>
            </Row>
          ))}
        </Group>
      )}

      {u.counters.last_error && u.counters.failed > 0 && (
        <Notice tone="warning" title={`${u.counters.failed} clip${u.counters.failed > 1 ? "s" : ""} couldn't be made`}>
          Last: {u.counters.last_error}. HomeFlix retries in 30 minutes.
        </Notice>
      )}

      <div className="flex flex-wrap gap-2.5">
        <Button icon={<Trash2 />} loading={busy === "cleanup"} onClick={() => post("cleanup", "Cleanup")}>
          Clean Up Now
        </Button>
        <Button icon={<Sparkles />} loading={busy === "generate-missing"} disabled={u.previews.missing === 0} onClick={() => post("generate-missing", "Queue missing previews")}>
          Make Missing Previews{u.previews.missing ? ` (${u.previews.missing})` : ""}
        </Button>
      </div>
      {u.last_cleanup && (
        <p className="-mt-3 px-1 text-[12px] text-white/40">
          Last cleanup {new Date(u.last_cleanup.at).toLocaleString()}: freed {fmtBytes(u.last_cleanup.orphan_bytes + u.last_cleanup.evicted_bytes + u.last_cleanup.other_bytes)}
        </p>
      )}
    </div>
  );
}
