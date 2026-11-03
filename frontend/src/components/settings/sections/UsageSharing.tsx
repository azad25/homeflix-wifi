"use client";

import React, { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { Group, Row, Toggle } from "../ui";

/** Settings > About: the anonymous daily install ping (opt-out). */
export default function UsageSharing() {
  const [s, setS] = useState<{ enabled: boolean; version: string } | null>(null);
  useEffect(() => {
    fetch(`${getApiUrl()}/api/admin/telemetry`).then((r) => r.json()).then(setS).catch(() => {});
  }, []);
  if (!s) return null;
  const set = async (enabled: boolean) => {
    setS({ ...s, enabled });
    const r = await fetch(`${getApiUrl()}/api/admin/telemetry`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }).catch(() => null);
    if (!r?.ok) setS({ ...s }); // roll back
  };
  return (
    <Group
      title="Usage count"
      footer="Once a day this server sends a random ID and its version (only that) so the project can count how many HomeFlix servers exist. It never sends your IP, name, library or what you watch."
    >
      <Row icon={<BarChart3 />} title="Count this server" description={`HomeFlix ${s.version} · shown on the Community page`}>
        <Toggle checked={s.enabled} onChange={set} label="Count this server" />
      </Row>
    </Group>
  );
}
