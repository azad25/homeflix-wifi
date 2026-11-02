"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, Sparkles } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useNavigate } from "@/hooks/useNavigate";

/** Queue a title for Auto Download (finds a release matching the quality profile). */
export default function AutoDownloadButton({
  tmdbId,
  mediaType,
  title,
  year,
  posterPath,
  seasons,
  className = "",
}: {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year?: number;
  posterPath?: string;
  seasons?: number;
  className?: string;
}) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${getApiUrl()}/api/autodownload`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const mine = (d.items || []).filter((i: any) => i.tmdb_id === tmdbId && i.media_type === mediaType);
        if (!mine.length) return;
        const order = ["downloading", "queued", "waiting", "failed", "completed", "in_library"];
        mine.sort((a: any, b: any) => order.indexOf(a.status) - order.indexOf(b.status));
        setStatus(mine[0].status);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tmdbId, mediaType]);

  const queue = async () => {
    if (status) {
      navigate.push("/my-list?tab=downloads");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/autodownload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdb_id: tmdbId,
          media_type: mediaType,
          title,
          year,
          poster_path: posterPath,
          seasons: mediaType === "tv" ? Array.from({ length: Math.max(1, seasons || 1) }, (_, i) => i + 1) : undefined,
          // Shows: keep following, so new seasons download after their finale.
          follow: mediaType === "tv",
        }),
      });
      if (res.ok) setStatus("queued");
    } finally {
      setBusy(false);
    }
  };

  const label =
    status === "downloading"
      ? "Downloading"
      : status === "completed" || status === "in_library"
        ? "In Library"
        : status === "scheduled"
          ? "Scheduled"
          : status
            ? "Queued"
            : "Auto Download";
  const icon = busy ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : status === "completed" || status === "in_library" ? (
    <CheckCircle2 className="h-4 w-4" />
  ) : status ? (
    <Clock className="h-4 w-4" />
  ) : (
    <Sparkles className="h-4 w-4" />
  );

  return (
    <button
      type="button"
      onClick={queue}
      disabled={busy}
      title={status ? "See the download queue" : "Let HomeFlix find and download the best release in the background"}
      className={`flex items-center gap-2 rounded bg-gray-500/40 px-3 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-gray-500/60 md:px-4 md:text-sm ${className}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
