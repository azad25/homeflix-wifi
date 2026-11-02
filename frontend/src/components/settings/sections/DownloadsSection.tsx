"use client";

import React, { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import TorrentDashboard from "@/components/TorrentDashboard";
import { SectionHeader } from "../ui";

export default function DownloadsSection() {
  const params = useSearchParams();
  // /settings?tab=downloads&media={...} preselects a title to search for
  const mediaInfo = useMemo(() => {
    const raw = params?.get("media");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [params]);

  return (
    <div className="space-y-8">
      <SectionHeader title="Downloads" description="Find, download and track new movies and shows." />
      <TorrentDashboard mediaInfo={mediaInfo ?? undefined} />
    </div>
  );
}
