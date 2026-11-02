"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Activity, Tv, Check } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useLog } from "../activity";
import { Badge, Button, Field, Group, Notice, Row, SectionHeader, Stat, Toggle, inputClass } from "../ui";

interface Settings {
  enabled: boolean;
  countries: string[];
  exclude_categories: string[];
  custom_playlists: string[];
  hide_offline: boolean;
}

interface Status {
  updated_at: string;
  channels: number;
  online: number;
  offline: number;
  unchecked: number;
  syncing: boolean;
  checking: boolean;
  checked_done: number;
  check_total: number;
  error?: string;
}

const COUNTRIES: [string, string][] = [
  ["BD", "Bangladesh"], ["IN", "India"], ["PK", "Pakistan"], ["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"],
  ["CN", "China"], ["HK", "Hong Kong"], ["TW", "Taiwan"], ["KR", "South Korea"], ["JP", "Japan"], ["FR", "France"], ["DE", "Germany"],
  ["ES", "Spain"], ["IT", "Italy"], ["NL", "Netherlands"], ["PT", "Portugal"], ["SE", "Sweden"], ["IE", "Ireland"], ["TR", "Turkey"],
  ["SA", "Saudi Arabia"], ["AE", "UAE"], ["QA", "Qatar"], ["KW", "Kuwait"], ["EG", "Egypt"], ["LB", "Lebanon"], ["JO", "Jordan"],
  ["MA", "Morocco"], ["AU", "Australia"], ["BR", "Brazil"], ["MX", "Mexico"],
];

const CATEGORIES = [
  "animation", "auto", "business", "classic", "comedy", "cooking", "culture", "documentary", "education", "entertainment", "family",
  "general", "kids", "legislative", "lifestyle", "movies", "music", "news", "outdoor", "relax", "religious", "science", "series",
  "shop", "sports", "travel", "weather",
];

const flag = (cc: string) => String.fromCodePoint(...cc.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function LiveTVSection() {
  const log = useLog();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [status, setStatus] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);
  const [playlists, setPlaylists] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/livetv`, { cache: "no-store" });
      const d = await r.json();
      setStatus(d.status);
      return d;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    load().then((d) => {
      if (!d) return;
      setSettings(d.settings);
      setSaved(JSON.stringify(d.settings));
      setPlaylists((d.settings.custom_playlists || []).join("\n"));
    });
  }, [load]);

  // Follow a running sync / check.
  useEffect(() => {
    if (!status?.syncing && !status?.checking) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [status?.syncing, status?.checking, load]);

  if (!settings) return <SectionHeader title="Live TV" description="Loading…" />;

  const current: Settings = { ...settings, custom_playlists: playlists.split("\n").map((s) => s.trim()).filter(Boolean) };
  const dirty = JSON.stringify(current) !== saved;

  const toggleIn = (key: "countries" | "exclude_categories", v: string) =>
    setSettings((s) => s && { ...s, [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v] });

  const save = async (next: Settings = current) => {
    setSaving(true);
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/livetv/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || r.statusText);
      setSettings(d.settings);
      setSaved(JSON.stringify(d.settings));
      setStatus(d.status);
      log("✅ Live TV settings saved - the channel list updates in the background");
    } catch (e) {
      log(`❌ Couldn't save Live TV settings: ${e}`);
    }
    setSaving(false);
  };

  const post = async (path: string, msg: string) => {
    await fetch(`${getApiUrl()}/api/admin/livetv/${path}`, { method: "POST" }).catch(() => null);
    log(msg);
    setTimeout(load, 800);
  };

  const busy = status?.syncing || status?.checking;

  return (
    <div className="space-y-10">
      <SectionHeader
        title="Live TV"
        description="Free-to-air channels from public broadcasters, checked regularly so only working channels show up."
        actions={
          <>
            <Button size="sm" icon={<Activity />} onClick={() => post("check", "🔍 Checking every channel…")} disabled={!!busy}>
              Check Channels
            </Button>
            <Button size="sm" icon={<RefreshCw className={status?.syncing ? "animate-spin" : ""} />} onClick={() => post("refresh", "🔄 Updating the channel list…")} disabled={!!busy}>
              Update List
            </Button>
          </>
        }
      />

      {status?.error && <Notice tone="danger" title="Couldn't update the channel list">{status.error}</Notice>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Channels" value={status?.channels ?? "—"} icon={<Tv />} />
        <Stat label="Working" value={status?.online ?? "—"} />
        <Stat label="Not working" value={status?.offline ?? "—"} />
        <Stat
          label={status?.checking ? "Checking" : "Last update"}
          value={
            status?.checking
              ? `${Math.round(((status.checked_done || 0) / Math.max(1, status.check_total)) * 100)}%`
              : status?.updated_at && !status.updated_at.startsWith("0001")
                ? new Date(status.updated_at).toLocaleDateString()
                : "—"
          }
          sub={status?.syncing ? "Downloading channel list…" : undefined}
        />
      </div>

      <Group title="General">
        <Row icon={<Tv />} title="Live TV" description="Show the Live TV tab and keep the channel list up to date.">
          <Toggle label="Live TV" checked={settings.enabled} onChange={(v) => save({ ...current, enabled: v })} />
        </Row>
        <Row icon={<Activity />} title="Hide channels that don't work" description="Channels that failed the last check are left out of the guide.">
          <Toggle label="Hide channels that don't work" checked={settings.hide_offline} onChange={(v) => save({ ...current, hide_offline: v })} />
        </Row>
      </Group>

      <Group title="Countries" description="Channels from these countries are included." padded>
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.map(([code, name]) => {
            const on = settings.countries.includes(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleIn("countries", code)}
                aria-pressed={on}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  on ? "bg-white text-black" : "bg-white/[0.08] text-white/70 hover:bg-white/[0.14]"
                }`}
              >
                {on && <Check className="h-3.5 w-3.5" />}
                {flag(code)} {name}
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Leave Out Categories" description="Adult channels are always excluded." padded>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const off = settings.exclude_categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleIn("exclude_categories", c)}
                aria-pressed={off}
                className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  off ? "bg-[#ff453a]/20 text-[#ff8b84] line-through" : "bg-white/[0.08] text-white/70 hover:bg-white/[0.14]"
                }`}
              >
                {cap(c)}
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Your Own Playlists" description="Optional M3U playlists, e.g. from a TV tuner on your network. They appear under My Channels." padded>
        <Field label="Playlist URLs (one per line)">
          <textarea
            value={playlists}
            onChange={(e) => setPlaylists(e.target.value)}
            rows={3}
            placeholder="http://192.168.0.50:8080/playlist.m3u"
            className={`${inputClass} h-auto py-2.5 font-mono text-[13px]`}
          />
        </Field>
      </Group>

      {dirty && (
        <div className="sticky bottom-4 z-10 flex justify-end">
          <div className="flex items-center gap-3 rounded-full bg-[#2c2c2e]/95 py-1.5 pl-4 pr-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
            <Badge tone="warning">Unsaved changes</Badge>
            <Button variant="primary" onClick={() => save()} loading={saving}>
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
