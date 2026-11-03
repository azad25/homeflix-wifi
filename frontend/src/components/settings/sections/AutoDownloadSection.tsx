"use client";

import React, { useEffect, useState } from "react";
import { Download, Gauge, HardDrive, Users, Layers, ShieldOff, Film } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useLog } from "../activity";
import { useSettingsNav } from "../nav";
import { Badge, Button, Field, Group, Notice, Row, SectionHeader, Toggle, inputClass } from "../ui";

interface S {
  enabled: boolean;
  profile: string;
  qualities: string[];
  preferred_sources: string[];
  blocked_terms: string[];
  min_seeders: number;
  max_movie_gb: number;
  max_season_gb: number;
  min_free_gb: number;
  max_concurrent: number;
  use_yts: boolean;
}

const PROFILES: { key: string; title: string; text: string }[] = [
  { key: "compact", title: "Compact HD", text: "1080p or 720p WEBRip, up to 3 GB a movie. Small, quick, good quality." },
  { key: "saver", title: "Data Saver", text: "720p first, up to 1.5 GB a movie." },
  { key: "fullhd", title: "Full HD", text: "1080p WEB-DL or Blu-ray, up to 8 GB a movie." },
  { key: "uhd", title: "4K", text: "2160p when available (up to 25 GB), otherwise 1080p." },
  { key: "custom", title: "Custom", text: "Set every rule yourself." },
];

const QUALITIES = ["2160p", "1080p", "720p", "480p"];
const SOURCES = ["webrip", "web-dl", "bluray", "hdtv"];
const LABEL: Record<string, string> = { webrip: "WEBRip", "web-dl": "WEB-DL", bluray: "Blu-ray", hdtv: "HDTV" };

export default function AutoDownloadSection() {
  const log = useLog();
  const go = useSettingsNav();
  const [s, setS] = useState<S | null>(null);
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [indexer, setIndexer] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`${getApiUrl()}/api/autodownload/settings`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setS(d.settings);
        setSaved(JSON.stringify(d.settings));
      })
      .catch(() => {});
    fetch(`${getApiUrl()}/api/torrents/config`, { cache: "no-store" })
      .then((r) => r.json())
      .then((c) => setIndexer(!!(c?.jackett_url && c?.jackett_api_key)))
      .catch(() => setIndexer(null));
  }, []);

  if (!s) return <SectionHeader title="Auto Download" description="Loading…" />;
  const dirty = JSON.stringify(s) !== saved;
  const custom = s.profile === "custom";
  // Editing a rule turns the preset into a custom profile.
  const set = (patch: Partial<S>) => setS({ ...s, ...patch, profile: "custom" });
  const toggleList = (key: "qualities" | "preferred_sources", v: string) => {
    const list = s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v];
    if (key === "qualities") list.sort((a, b) => QUALITIES.indexOf(a) - QUALITIES.indexOf(b));
    set({ [key]: list } as Partial<S>);
  };

  const save = async (next: S = s) => {
    setSaving(true);
    try {
      const r = await fetch(`${getApiUrl()}/api/autodownload/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || r.statusText);
      setS(d.settings);
      setSaved(JSON.stringify(d.settings));
      log("✅ Auto Download settings saved");
    } catch (e) {
      log(`❌ Couldn't save Auto Download settings: ${e}`);
    }
    setSaving(false);
  };

  const chip = (on: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${on ? "bg-white text-black" : "bg-white/[0.08] text-white/70 hover:bg-white/[0.14]"}`;

  return (
    <div className="space-y-10">
      <SectionHeader
        title="Auto Download"
        description="Titles you add to the download list (My List > Downloads, or Auto Download on a movie or show) are fetched in the background with these rules."
        actions={
          <Button size="sm" icon={<Download />} onClick={() => (window.location.href = "/my-list?tab=downloads")}>
            Open Queue
          </Button>
        }
      />

      {indexer === false && (
        <Notice
          tone="info"
          title="Connect a torrent indexer for the best results"
          action={
            <Button size="sm" onClick={() => go("downloads")}>
              Set Up Jackett
            </Button>
          }
        >
          Without Jackett, Auto Download can only find movies (via YTS). TV seasons need an indexer.
        </Notice>
      )}

      <Group title="General">
        <Row icon={<Download />} title="Auto Download" description="Process the download list in the background.">
          <Toggle label="Auto Download" checked={s.enabled} onChange={(v) => save({ ...s, enabled: v })} />
        </Row>
        <Row icon={<Layers />} title="Downloads at once" description="How many titles download at the same time.">
          <select aria-label="Downloads at once" value={s.max_concurrent} onChange={(e) => setS({ ...s, max_concurrent: +e.target.value })} className="h-9 rounded-lg bg-white/[0.08] px-3 text-[14px] text-white">
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </Row>
        <Row icon={<HardDrive />} title="Keep free space" description="Never fill a drive below this much free space.">
          <span className="flex items-center gap-2 text-[14px] text-white/70">
            <input type="number" min={0} step={5} value={s.min_free_gb} onChange={(e) => setS({ ...s, min_free_gb: +e.target.value })} className="h-9 w-20 rounded-lg bg-white/[0.08] px-2 text-right text-white" aria-label="Keep free space in GB" />
            GB
          </span>
        </Row>
        <Row icon={<Film />} title="Search YTS for movies" description="Small, good-quality movie encodes; works without an indexer.">
          <Toggle label="Search YTS for movies" checked={s.use_yts} onChange={(v) => setS({ ...s, use_yts: v })} />
        </Row>
      </Group>

      <Group title="Quality Profile" padded>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PROFILES.map((p) => {
            const on = s.profile === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => (p.key === "custom" ? setS({ ...s, profile: "custom" }) : save({ ...s, profile: p.key }))}
                aria-pressed={on}
                className={`rounded-xl p-4 text-left ring-1 ring-inset transition-colors ${on ? "bg-white text-black ring-white" : "bg-white/[0.04] text-white ring-white/[0.08] hover:bg-white/[0.07]"}`}
              >
                <p className="text-[15px] font-semibold">{p.title}</p>
                <p className={`mt-0.5 text-[13px] ${on ? "text-black/60" : "text-white/50"}`}>{p.text}</p>
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Rules" description={custom ? "Your own rules." : "Set by the profile. Changing any rule switches to Custom."} padded>
        <div className="space-y-5">
          <Field label="Qualities, best first">
            <div className="flex flex-wrap gap-2">
              {QUALITIES.map((q) => (
                <button key={q} type="button" className={chip(s.qualities.includes(q))} onClick={() => toggleList("qualities", q)}>
                  {q === "2160p" ? "4K (2160p)" : q}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Preferred sources">
            <div className="flex flex-wrap gap-2">
              {SOURCES.map((x) => (
                <button key={x} type="button" className={chip(s.preferred_sources.includes(x))} onClick={() => toggleList("preferred_sources", x)}>
                  {LABEL[x]}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Max movie size (GB)">
              <input type="number" min={0.5} step={0.5} className={inputClass} value={s.max_movie_gb} onChange={(e) => set({ max_movie_gb: +e.target.value })} />
            </Field>
            <Field label="Max season size (GB)">
              <input type="number" min={1} step={1} className={inputClass} value={s.max_season_gb} onChange={(e) => set({ max_season_gb: +e.target.value })} />
            </Field>
            <Field label="Minimum seeders">
              <input type="number" min={1} className={inputClass} value={s.min_seeders} onChange={(e) => set({ min_seeders: +e.target.value })} />
            </Field>
          </div>
          <Field label="Never download releases containing" hint="Comma separated. Cam and screener rips are blocked by default.">
            <input
              className={inputClass}
              value={s.blocked_terms.join(", ")}
              onChange={(e) => set({ blocked_terms: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
            />
          </Field>
        </div>
      </Group>

      <Group title="How It Works" padded>
        <ul className="space-y-2 text-[13px] leading-relaxed text-white/60">
          <li className="flex gap-2"><Gauge className="mt-0.5 h-4 w-4 shrink-0" /> Picks the best release: your quality order first, then preferred source, more seeders and smaller size.</li>
          <li className="flex gap-2"><HardDrive className="mt-0.5 h-4 w-4 shrink-0" /> Waits until a drive has room for the release plus your free-space reserve, then downloads to the drive with the most space.</li>
          <li className="flex gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0" /> If nothing fits yet it checks again later, so new releases are picked up automatically.</li>
          <li className="flex gap-2"><ShieldOff className="mt-0.5 h-4 w-4 shrink-0" /> If a download fails, it tries another release (up to 3 times).</li>
        </ul>
      </Group>

      {dirty && (
        <div className="sticky bottom-4 z-10 flex justify-end">
          <div className="flex items-center gap-3 rounded-full bg-[#2c2c2e]/95 py-1.5 pl-4 pr-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
            <Badge tone="info">Unsaved changes</Badge>
            <Button variant="primary" onClick={() => save()} loading={saving}>
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
