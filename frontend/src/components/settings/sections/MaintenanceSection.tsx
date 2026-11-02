"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Search, Zap, RefreshCw, Timer, ImageIcon, Trash2, Film, HardDrive, Activity, TrendingUp, Database } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useDialog } from "@/hooks/useDialog";
import { useLog } from "../activity";
import { ActionTile, Button, Dot, EmptyState, Group, SectionHeader, Stat, TileGrid } from "../ui";

const SCANS = [
  { key: "full", icon: <Search />, title: "Full Scan", description: "Scan every media folder for new files and refresh metadata." },
  { key: "incremental", icon: <Zap />, title: "Quick Scan", description: "Only look at recently changed files." },
  { key: "superfast", icon: <Timer />, title: "Superfast Scan", description: "Minimal processing for a near-instant refresh." },
  { key: "database-sync", icon: <RefreshCw />, title: "Sync Library", description: "Match the database to what's on disk." },
] as const;

const fmtBytes = (n?: number) => {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i > 1 ? 1 : 0)} ${u[i]}`;
};

export default function MaintenanceSection() {
  const log = useLog();
  const dialog = useDialog();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [scanStats, setScanStats] = useState<any>(null);
  const [cache, setCache] = useState<any>(null);
  const [queues, setQueues] = useState<Record<string, any> | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      await fn();
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    const get = (path: string) =>
      fetch(`${getApiUrl()}${path}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    const [scan, cacheStats, queueStats] = await Promise.all([
      get("/api/admin/scan/stats"),
      get("/api/admin/assets/cache/stats"),
      get("/api/celery/queues/status"),
    ]);
    // Go serialises ScanStats without json tags: {stats: {TotalFiles, ...}}
    const st = scan?.stats || scan;
    setScanStats(
      st
        ? {
            totalFiles: st.TotalFiles ?? st.totalFiles,
            processed: st.ProcessedFiles ?? st.processed,
            skipped: st.SkippedFiles ?? st.skipped,
            errors: st.ErrorFiles ?? st.errors,
          }
        : null
    );
    setCache(cacheStats);
    setQueues(queueStats && typeof queueStats === "object" ? queueStats : null);
    setLoadingStats(false);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const scan = (type: string, label: string) =>
    run(type, async () => {
      log(`🚀 ${label} started…`);
      try {
        const res = await fetch(`${getApiUrl()}/api/admin/scan/${type}`, { method: "POST" });
        if (res.ok) {
          const result = await res.json().catch(() => null);
          log(`✅ ${label} finished`);
          if (result) log(`📊 ${JSON.stringify(result, null, 2)}`);
          loadStats();
        } else {
          log(`❌ ${label} failed: ${res.status} ${res.statusText}`);
        }
      } catch (e) {
        log(`❌ ${label} failed: ${e}`);
      }
    });

  const regenerate = () =>
    run("regenerate", async () => {
      if (!(await dialog.confirm("Regenerate all artwork?", "Thumbnails and preview clips are rebuilt for the whole library in the background. This can keep the server busy for a while."))) return;
      log("🔄 Regenerating thumbnails and previews…");
      try {
        const res = await fetch(`${getApiUrl()}/api/admin/scan/regenerate-assets`, { method: "POST" });
        log(res.ok ? "✅ Asset regeneration started in the background" : `❌ Asset regeneration failed: ${res.statusText}`);
      } catch (e) {
        log(`❌ Asset regeneration failed: ${e}`);
      }
    });

  const cleanup = () =>
    run("cleanup-invalid", async () => {
      if (!(await dialog.confirm("Clean up the database?", "Entries whose files no longer exist are removed. Media files on disk are never deleted.", true))) return;
      await scan("cleanup-invalid", "Database cleanup");
    });

  const tmdb = () =>
    run("tmdb", async () => {
      log("🎬 Refreshing TMDB artwork and trailers for the whole library…");
      try {
        const res = await fetch(`${getApiUrl()}/api/admin/update-tmdb-data`, { method: "POST", headers: { "Content-Type": "application/json" } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          log(`❌ TMDB refresh failed: ${data.error || res.statusText}`);
          return;
        }
        log(`✅ TMDB refresh finished: ${data.updated ?? 0} of ${data.total ?? 0} items updated`);
        (data.errors || []).slice(0, 5).forEach((e: string) => log(`   • ${e}`));
        if ((data.errors || []).length > 5) log(`   • … and ${data.errors.length - 5} more`);
      } catch (e) {
        log(`❌ TMDB refresh failed: ${e}`);
      }
    });

  const clearCache = () =>
    run("cache", async () => {
      if (!(await dialog.confirm("Clear the image cache?", "Cached artwork is rebuilt on demand, so pages may load a little slower for a while."))) return;
      try {
        const res = await fetch(`${getApiUrl()}/api/admin/assets/cache/clear`, { method: "DELETE" });
        log(res.ok ? "✅ Cache cleared" : `❌ Clearing the cache failed: ${res.statusText}`);
        loadStats();
      } catch (e) {
        log(`❌ Clearing the cache failed: ${e}`);
      }
    });

  const diagnostics = () =>
    run("diag", async () => {
      log("🔍 Checking server endpoints…");
      const endpoints = [
        ["Library", "/api/media"],
        ["Scan stats", "/api/admin/scan/stats"],
        ["Cache stats", "/api/admin/assets/cache/stats"],
        ["Task queues", "/api/celery/queues/status"],
        ["Updates", "/api/admin/update/check"],
      ];
      let failed = 0;
      await Promise.all(
        endpoints.map(async ([name, url]) => {
          try {
            const r = await fetch(`${getApiUrl()}${url}`, { cache: "no-store" });
            if (!r.ok) failed++;
            log(`${r.ok ? "  ✓" : "  ✗"} ${name}: ${r.status}`);
          } catch {
            failed++;
            log(`  ✗ ${name}: unreachable`);
          }
        })
      );
      log(failed ? `❌ ${failed} of ${endpoints.length} checks failed (see Activity)` : `✅ All ${endpoints.length} server checks passed`);
    });

  const queueEntries = queues ? Object.entries(queues).filter(([, q]) => q && typeof q === "object") : [];

  return (
    <div className="space-y-10">
      <SectionHeader
        title="Maintenance"
        description="Scan for new media, repair the library and keep the server tidy."
        actions={
          <Button size="sm" icon={<RefreshCw className={loadingStats ? "animate-spin" : ""} />} onClick={loadStats} disabled={loadingStats}>
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Files scanned" value={scanStats?.totalFiles ?? "—"} icon={<Database />} />
        <Stat label="Processed" value={scanStats?.processed ?? "—"} />
        <Stat label="Skipped" value={scanStats?.skipped ?? "—"} />
        <Stat label="Errors" value={scanStats?.errors ?? "—"} />
      </div>

      <Group title="Scan Library" description="New files are also picked up automatically while HomeFlix runs.">
        <TileGrid>
          {SCANS.map((s) => (
            <ActionTile
              key={s.key}
              flat
              icon={s.icon}
              title={s.title}
              description={s.description}
              loading={busy[s.key]}
              disabled={Object.values(busy).some(Boolean) && !busy[s.key]}
              onClick={() => scan(s.key, s.title)}
            />
          ))}
        </TileGrid>
      </Group>

      <Group title="Artwork & Metadata">
        <TileGrid>
          <ActionTile flat icon={<Film />} title="Refresh from TMDB" description="Fetch backdrops, logos and trailers for every movie and show." loading={busy.tmdb} onClick={tmdb} />
          <ActionTile flat icon={<ImageIcon />} title="Regenerate Thumbnails" description="Rebuild thumbnails and preview clips for the whole library." loading={busy.regenerate} onClick={regenerate} />
        </TileGrid>
      </Group>

      <Group
        title="Cache & Health"
        actions={
          <Button size="sm" icon={<TrendingUp />} onClick={diagnostics} loading={busy.diag}>
            Run Diagnostics
          </Button>
        }
      >
        <TileGrid>
          <div className="p-4 md:p-5">
            <p className="text-[13px] text-white/50">Image cache</p>
            <p className="mt-1 text-[22px] font-bold text-white">{cache?.totalSize != null ? fmtBytes(cache.totalSize) : "—"}</p>
            <p className="text-[12px] text-white/40">
              {cache?.totalEntries ?? 0} entries
              {cache?.hitRate != null ? ` · ${(cache.hitRate * 100).toFixed(0)}% hit rate` : ""}
            </p>
          </div>
          <ActionTile flat icon={<HardDrive />} title="Clear Image Cache" description="Free disk space; artwork is rebuilt when it's next needed." loading={busy.cache} onClick={clearCache} />
        </TileGrid>
        <ActionTile flat icon={<Trash2 />} danger title="Clean Up Database" description="Remove entries for files that no longer exist. Media on disk is never deleted." loading={busy["cleanup-invalid"]} onClick={cleanup} />
      </Group>

      <Group title="Background Tasks" description="Workers that generate artwork, previews and metadata.">
        {queueEntries.length === 0 ? (
          <EmptyState icon={<Activity />} title={loadingStats ? "Loading…" : "No task queues reported"} description={loadingStats ? undefined : "The task worker is idle or not running."} />
        ) : (
          queueEntries.map(([name, q]: [string, any]) => (
            <div key={name} className="flex items-center gap-3 px-4 py-3 md:px-5">
              <Dot tone={q.active ? "success" : "neutral"} />
              <span className="flex-1 truncate text-[15px] capitalize text-white">{name.replace(/_/g, " ")}</span>
              <span className="text-[13px] tabular-nums text-white/50">
                {q.length || 0} task{q.length === 1 ? "" : "s"} · {q.active ? "active" : "idle"}
              </span>
            </div>
          ))
        )}
      </Group>
    </div>
  );
}
