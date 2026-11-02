"use client";

import React, { useEffect, useState } from "react";
import { Download, CheckCircle2, AlertTriangle, ArrowUpCircle, MonitorSmartphone, HardDrive, Film, Sparkles } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useLog } from "../activity";
import { Group, Row, SectionHeader, Toggle } from "../ui";

type Prefs = Record<
  "download_started" | "download_completed" | "download_problems" | "server_updates" | "tv_app_updates" | "low_storage" | "new_content" | "recommendations",
  boolean
>;

const ROWS: { group: string; items: { key: keyof Prefs; icon: React.ReactNode; title: string; text: string }[] }[] = [
  {
    group: "Downloads",
    items: [
      { key: "download_started", icon: <Download />, title: "Download started", text: "When Auto Download starts a title." },
      { key: "download_completed", icon: <CheckCircle2 />, title: "Ready to watch", text: "When a download finishes and is in your library." },
      { key: "download_problems", icon: <AlertTriangle />, title: "Download problems", text: "Not enough space, or a download that keeps failing." },
    ],
  },
  {
    group: "Server",
    items: [
      { key: "server_updates", icon: <ArrowUpCircle />, title: "HomeFlix updates", text: "New updates and releases, and when an update was installed." },
      { key: "tv_app_updates", icon: <MonitorSmartphone />, title: "TV app updates", text: "A new TV app build is available or was published to your TVs." },
      { key: "low_storage", icon: <HardDrive />, title: "Low storage", text: "When a media folder is running out of space." },
    ],
  },
  {
    group: "Watching",
    items: [
      { key: "new_content", icon: <Film />, title: "New in your library", text: "New movies and episodes added to HomeFlix." },
      { key: "recommendations", icon: <Sparkles />, title: "Suggestions", text: "Trending, coming soon, continue watching and picks for you." },
    ],
  },
];

export default function NotificationsSection() {
  const log = useLog();
  const [p, setP] = useState<Prefs | null>(null);

  useEffect(() => {
    fetch(`${getApiUrl()}/api/notifications/settings`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setP)
      .catch(() => {});
  }, []);

  const update = async (key: keyof Prefs, v: boolean) => {
    if (!p) return;
    const next = { ...p, [key]: v };
    setP(next);
    try {
      const r = await fetch(`${getApiUrl()}/api/notifications/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (!r.ok) throw new Error(r.statusText);
    } catch (e) {
      setP(p);
      log(`❌ Couldn't save notification settings: ${e}`);
    }
  };

  return (
    <div className="space-y-10">
      <SectionHeader title="Notifications" description="Choose what shows up in Notifications for everyone in the household." />
      {ROWS.map((g) => (
        <Group key={g.group} title={g.group}>
          {g.items.map((it) => (
            <Row key={it.key} icon={it.icon} title={it.title} description={it.text}>
              <Toggle label={it.title} checked={!!p?.[it.key]} disabled={!p} onChange={(v) => update(it.key, v)} />
            </Row>
          ))}
        </Group>
      ))}
    </div>
  );
}
