"use client";

import React, { useEffect, useState } from "react";
import { Film, Tv, HardDrive, Download, ArrowUpCircle, Search, Activity, AlertTriangle, CheckCircle2, MonitorSmartphone, ChevronRight } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useLog } from "../activity";
import { useSettingsNav } from "../nav";
import { fetchUpdateInfo } from "./UpdatesSection";
import { ActionTile, Group, Row, SectionHeader, Stat, TileGrid } from "../ui";

const GB = 1024 ** 3;

interface Overview {
  movies: number | null;
  shows: number | null;
  storage: { free: number; total: number; low: any[] } | null;
  downloads: number | null;
  update: any;
  tv: any;
}

const getJSON = (path: string) =>
  fetch(`${getApiUrl()}${path}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

export default function DashboardSection() {
  const go = useSettingsNav();
  const log = useLog();
  const [o, setO] = useState<Overview>({ movies: null, shows: null, storage: null, downloads: null, update: null, tv: null });
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let alive = true;
    const set = (patch: Partial<Overview>) => alive && setO((p) => ({ ...p, ...patch }));
    // Each tile fills in as its request lands (no all-or-nothing spinner).
    getJSON("/api/media").then((m) => set({ movies: Array.isArray(m) ? m.filter((x: any) => x.type !== "episode" && x.type !== "tv").length : null }));
    getJSON("/api/series").then((s) => set({ shows: Array.isArray(s) ? s.length : null }));
    getJSON("/api/admin/storage/stats").then((s) => {
      const list: any[] = s?.storages || [];
      set({
        storage: list.length
          ? { free: list.reduce((a, x) => a + (x.free || 0), 0), total: list.reduce((a, x) => a + (x.total || 0), 0), low: s?.low_alerts || [] }
          : null,
      });
    });
    getJSON("/api/torrents/downloads").then((d) =>
      set({ downloads: Array.isArray(d?.downloads) ? d.downloads.filter((x: any) => x.status === "downloading").length : null })
    );
    fetchUpdateInfo().then((u) => set({ update: u }));
    getJSON("/api/admin/app/tv/source").then((t) => set({ tv: t }));
    return () => {
      alive = false;
    };
  }, []);

  const quickScan = async () => {
    setScanning(true);
    log("🚀 Quick scan started…");
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/scan/incremental`, { method: "POST" });
      log(res.ok ? "✅ Quick scan finished" : `❌ Quick scan failed: ${res.statusText}`);
    } catch (e) {
      log(`❌ Quick scan failed: ${e}`);
    }
    setScanning(false);
  };

  // Things that need the user's attention, most important first.
  const attention: { icon: React.ReactNode; title: string; description: string; to: Parameters<typeof go>[0] }[] = [];
  if (o.storage?.low.length) {
    attention.push({
      icon: <AlertTriangle />,
      title: `Low storage on ${o.storage.low.length} folder${o.storage.low.length > 1 ? "s" : ""}`,
      description: o.storage.low.map((s: any) => `${s.name || s.path}: ${(s.free / GB).toFixed(1)} GB free`).join(" · "),
      to: "storage",
    });
  }
  if (o.update?.ok && o.update.upgrade?.branch) {
    attention.push({ icon: <ArrowUpCircle />, title: `HomeFlix ${o.update.upgrade.version} is available`, description: "A new release is ready to install.", to: "updates" });
  } else if (o.update?.ok && o.update.update_available) {
    attention.push({ icon: <ArrowUpCircle />, title: "Server update available", description: `${o.update.behind} new change${o.update.behind > 1 ? "s" : ""} on ${o.update.branch}`, to: "updates" });
  }
  if (o.tv?.update_available && o.tv?.remote) {
    attention.push({ icon: <MonitorSmartphone />, title: `TV app ${o.tv.remote.version_name} is available`, description: "Download it to the server so TVs can update.", to: "updates" });
  }

  const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString());

  return (
    <div className="space-y-10">
      <SectionHeader title="Dashboard" description="Your HomeFlix server at a glance." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Movies" value={fmt(o.movies)} icon={<Film />} onClick={() => go("library")} />
        <Stat label="TV Shows" value={fmt(o.shows)} icon={<Tv />} onClick={() => go("library")} />
        <Stat
          label="Free space"
          value={o.storage ? `${(o.storage.free / GB).toFixed(0)} GB` : "—"}
          sub={o.storage ? `of ${(o.storage.total / GB).toFixed(0)} GB` : undefined}
          icon={<HardDrive />}
          onClick={() => go("storage")}
        />
        <Stat label="Downloading" value={fmt(o.downloads)} icon={<Download />} onClick={() => go("downloads")} />
      </div>

      <Group title="Status">
        {attention.length === 0 ? (
          <Row
            icon={<CheckCircle2 className="text-[#30d158]" />}
            title={o.update ? "Everything looks good" : "Checking…"}
            description={o.update?.ok ? "HomeFlix is up to date and storage is healthy." : undefined}
          />
        ) : (
          attention.map((a) => (
            <Row key={a.title} icon={a.icon} title={a.title} description={a.description} onClick={() => go(a.to)}>
              <ChevronRight className="h-4 w-4 text-white/35" />
            </Row>
          ))
        )}
      </Group>

      <Group title="Quick Actions">
        <TileGrid>
          <ActionTile flat icon={<Search />} title="Quick Scan" description="Pick up newly added files." loading={scanning} onClick={quickScan} />
          <ActionTile flat icon={<Activity />} title="Server Monitor" description="CPU, memory, services and logs." onClick={() => go("server")} />
        </TileGrid>
      </Group>
    </div>
  );
}
