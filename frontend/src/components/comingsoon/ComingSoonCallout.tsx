"use client";

import React, { useEffect, useState } from "react";
import { Bell, BellRing, CalendarClock, Check } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import type { ComingSoonItem } from "./ComingSoonShowcase";

/**
 * On a title page: when the title is in the Coming Soon lineup, show its
 * release date, the server's trailer and Notify Me (Auto Download on
 * release day). Renders nothing otherwise.
 */
export default function ComingSoonCallout({ tmdbId, type, className = "" }: { tmdbId: number | string; type: "movie" | "tv"; className?: string }) {
  const [it, setIt] = useState<ComingSoonItem | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${getApiUrl()}/api/comingsoon/title/${type}/${tmdbId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setIt(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tmdbId, type]);

  if (!it) return null;
  const local = it.trailer.video_url ? `${getApiUrl()}${it.trailer.video_url}` : "";
  const date = new Date(it.release_date + "T00:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const toggle = async () => {
    setBusy(true);
    try {
      const r = it.notify.on
        ? await fetch(`${getApiUrl()}/api/comingsoon/notify/${it.media_type}/${it.tmdb_id}`, { method: "DELETE" })
        : await fetch(`${getApiUrl()}/api/comingsoon/notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ media_type: it.media_type, tmdb_id: it.tmdb_id }),
          });
      if (r.ok) setIt({ ...it, notify: { on: !it.notify.on, status: it.notify.on ? "" : "scheduled" } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Coming Soon" className={`overflow-hidden rounded-[24px] bg-white/[0.045] ring-1 ring-inset ring-white/[0.08] ${className}`}>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="relative aspect-video bg-black">
          {local ? (
            <video src={local} poster={it.backdrop_url} controls playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
          ) : it.trailer.youtube_id ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${it.trailer.youtube_id}?rel=0`}
              title={`${it.title} trailer`}
              allow="encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.backdrop_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
        </div>
        <div className="flex flex-col justify-center gap-4 p-6 md:p-8">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-bold uppercase tracking-[0.06em] text-black">
            <CalendarClock className="h-3.5 w-3.5" /> Coming Soon
          </span>
          <div>
            <p className="text-[22px] font-bold tracking-[-0.02em] text-white md:text-[26px]">
              {it.release_label && it.media_type === "tv" ? `${it.release_label} · ` : ""}
              {it.days_until <= 1 ? "Tomorrow" : `In ${it.days_until} days`}
            </p>
            <p className="mt-1 text-[14px] text-white/60">{date}{it.studio ? ` · ${it.studio}` : ""}</p>
          </div>
          <p className="text-[14px] leading-relaxed text-white/65">
            Ranked #{it.rank} among the most anticipated {it.media_type === "tv" ? "series" : "movies"}. Turn on Notify Me and HomeFlix downloads it
            {it.media_type === "tv" ? " (and the seasons after it)" : ""} on release day.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              disabled={busy}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-semibold transition ${
                it.notify.on ? "bg-white/15 text-white ring-1 ring-inset ring-white/25 hover:bg-white/25" : "bg-white text-black hover:bg-white/90"
              }`}
            >
              {it.notify.on ? <Check className="h-[18px] w-[18px]" /> : <Bell className="h-[18px] w-[18px]" />}
              {it.notify.on ? "We'll Notify You" : "Notify Me"}
            </button>
            {it.notify.on && (
              <span className="flex items-center gap-1.5 text-[12px] text-white/50">
                <BellRing className="h-3.5 w-3.5" /> In Auto Download{it.notify.status ? ` · ${it.notify.status}` : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
