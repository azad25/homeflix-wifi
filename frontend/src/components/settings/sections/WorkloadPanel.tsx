"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Cpu, MemoryStick, HardDrive, MonitorPlay, PauseCircle } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useLog } from "../activity";
import { Badge, Dot, Group, Row, Stat, Toggle } from "../ui";

interface ClassStatus { limit: number; running: number; waiting: number; granted: number }
interface Status {
  mode: "idle" | "watching" | "busy" | "critical";
  reason: string;
  paused: boolean;
  sample: {
    cores: number; load1: number; load_per_core: number; cpu_pressure: number; io_pressure: number;
    mem_total_mb: number; mem_avail_mb: number; mem_avail_pct: number; streams: number;
  };
  classes: Record<string, ClassStatus>;
}

const MODE: Record<Status["mode"], { label: string; tone: "success" | "info" | "warning" | "danger"; text: string }> = {
  idle: { label: "Idle", tone: "success", text: "Plenty of headroom: background work runs at full speed." },
  watching: { label: "Someone is watching", tone: "info", text: "Playback comes first: scanning and encodes slow to one at a time, trailer encodes wait." },
  busy: { label: "Busy", tone: "warning", text: "The CPU or disk is saturated: background work runs one at a time." },
  critical: { label: "Under pressure", tone: "danger", text: "Memory is short or the CPU is overloaded: only what a viewer is waiting on runs." },
};

const CLASSES: { key: string; label: string; hint: string }[] = [
  { key: "interactive", label: "Interactive", hint: "Hover previews and artwork a viewer is waiting for" },
  { key: "scan", label: "Library scanning", hint: "Probing new files" },
  { key: "background", label: "Previews & thumbnails", hint: "Clips and frames nobody is waiting for yet" },
  { key: "bulk", label: "Trailer encodes", hint: "Coming Soon trailers and other low-priority work" },
];

const pct = (v: number) => (v < 0 ? "n/a" : `${v.toFixed(0)}%`);

/** Settings > Server: how HomeFlix shares this machine between playback and background work. */
export default function WorkloadPanel() {
  const log = useLog();
  const [s, setS] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/system/governor`, { cache: "no-store" });
      if (r.ok) setS(await r.json());
    } catch {
      /* offline: keep the last reading */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const setPaused = async (paused: boolean) => {
    setSaving(true);
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/system/governor`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setS(await r.json());
      log(paused ? "⏸ Background work paused" : "▶ Background work resumed");
    } catch (e: any) {
      log(`❌ Couldn't change background work: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  if (!s) return null;
  const m = MODE[s.mode] || MODE.idle;
  const mem = s.sample;

  return (
    <div className="space-y-6">
      <Group
        title="Workload"
        description="HomeFlix shares this machine between playback and background work, checking the load every 2 seconds."
        actions={<Badge tone={m.tone}><Dot tone={m.tone} /> {m.label}</Badge>}
        padded
        footer={`${m.text} ${s.reason ? `(${s.reason})` : ""}`}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="CPU load" icon={<Cpu />} value={`${Math.round(mem.load_per_core * 100)}%`} sub={`${mem.load1.toFixed(2)} on ${mem.cores} cores · waiting ${pct(mem.cpu_pressure)}`} />
          <Stat label="Memory free" icon={<MemoryStick />} value={`${mem.mem_avail_pct.toFixed(0)}%`} sub={`${(mem.mem_avail_mb / 1024).toFixed(1)} of ${(mem.mem_total_mb / 1024).toFixed(1)} GB`} />
          <Stat label="Disk waiting" icon={<HardDrive />} value={pct(mem.io_pressure)} sub="Time tasks waited on storage" />
          <Stat label="Playing now" icon={<MonitorPlay />} value={mem.streams} sub={mem.streams === 1 ? "stream" : "streams"} />
        </div>
      </Group>

      <Group title="Work queues" description="Slots each kind of work may use right now. Playback is never limited.">
        {CLASSES.map((c) => {
          const v = s.classes?.[c.key] || { limit: 0, running: 0, waiting: 0, granted: 0 };
          const tone = v.limit === 0 ? (v.waiting > 0 ? "warning" : "neutral") : v.running > 0 ? "success" : "neutral";
          return (
            <Row key={c.key} title={c.label} description={c.hint}>
              {v.waiting > 0 && <Badge tone="neutral">{v.waiting} waiting</Badge>}
              <Badge tone={tone as any}>
                {v.limit === 0 ? "On hold" : `${v.running} of ${v.limit} running`}
              </Badge>
            </Row>
          );
        })}
        <Row
          icon={<PauseCircle />}
          title="Pause background work"
          description="Stops scanning, preview generation and trailer encodes until you turn this off. Playback and hover previews keep working."
        >
          <Toggle checked={s.paused} onChange={setPaused} disabled={saving} label="Pause background work" />
        </Row>
      </Group>
    </div>
  );
}
