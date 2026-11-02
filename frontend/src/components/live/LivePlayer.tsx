"use client";

import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Loader2, Maximize, Volume2, VolumeX, WifiOff } from "lucide-react";
import { getApiUrl } from "@/lib/api";

export interface LiveChannel {
  id: string;
  name: string;
  country: string;
  categories?: string[];
  logo?: string;
  status: string;
  quality?: string;
  number: number;
}

type State = "idle" | "loading" | "playing" | "failed";

/**
 * Live HLS player. Gets the channel's proxied sources from the server and
 * fails over to the next source on a fatal error, like a TV retuning.
 */
export default function LivePlayer({
  channel,
  onFailed,
}: {
  channel: LiveChannel | null;
  onFailed?: (channel: LiveChannel) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("idle");
  const [muted, setMuted] = useState(false);
  const [osd, setOsd] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel) return;
    let cancelled = false;
    let sources: string[] = [];
    let idx = 0;
    setState("loading");
    setOsd(true);
    const osdTimer = setTimeout(() => setOsd(false), 3500);

    const destroy = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };

    const tryNext = () => {
      if (cancelled) return;
      destroy();
      if (idx >= sources.length) {
        setState("failed");
        onFailed?.(channel);
        return;
      }
      const src = sources[idx++];
      const url = src.startsWith("http") ? src : `${getApiUrl()}${src}`;
      if (Hls.isSupported()) {
        const hls = new Hls({
          // Live TV: start fast, keep a modest buffer, follow the live edge.
          liveSyncDurationCount: 3,
          maxBufferLength: 20,
          maxMaxBufferLength: 40,
          backBufferLength: 20,
          capLevelToPlayerSize: true,
          startLevel: -1,
          manifestLoadingTimeOut: 12000,
          manifestLoadingMaxRetry: 1,
          levelLoadingTimeOut: 12000,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 3,
        });
        hlsRef.current = hls;
        let recovered = false;
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
            recovered = true;
            hls.recoverMediaError();
            return;
          }
          tryNext(); // next source for this channel
        });
        hls.loadSource(url);
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.onerror = () => tryNext();
      } else {
        setState("failed");
        return;
      }
      video.play().catch(() => {
        // Autoplay with sound blocked: start muted, the user can unmute.
        video.muted = true;
        setMuted(true);
        video.play().catch(() => {});
      });
    };

    (async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/livetv/channels/${encodeURIComponent(channel.id)}/play`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        sources = Array.isArray(data?.urls) ? data.urls : [];
        tryNext();
      } catch {
        if (!cancelled) setState("failed");
      }
    })();

    const onPlaying = () => setState("playing");
    const onWaiting = () => setState((s) => (s === "playing" ? "loading" : s));
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    return () => {
      cancelled = true;
      clearTimeout(osdTimer);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.onerror = null;
      destroy();
      video.removeAttribute("src");
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const fullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (e.key === "f" || e.key === "F") fullscreen();
      if (e.key === "m" || e.key === "M") setMuted((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={wrapRef} className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/[0.08]" onDoubleClick={fullscreen}>
      <video ref={videoRef} className="h-full w-full bg-black object-contain" playsInline autoPlay />

      {!channel && (
        <div className="absolute inset-0 flex items-center justify-center text-[15px] text-white/50">Pick a channel to start watching</div>
      )}

      {channel && state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-white/70" />
        </div>
      )}

      {channel && state === "failed" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center">
          <WifiOff className="h-9 w-9 text-white/50" />
          <p className="text-[16px] font-semibold text-white">{channel.name} isn&apos;t available right now</p>
          <p className="text-[13px] text-white/55">The broadcaster may be offline or block this region. Try another channel.</p>
        </div>
      )}

      {/* On-screen display, like a TV banner when changing channels */}
      {channel && (
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent p-4 transition-opacity duration-300 md:p-5 ${
            osd || state !== "playing" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <span className="rounded-lg bg-white/15 px-2.5 py-1 font-mono text-[15px] font-bold tabular-nums text-white">{channel.number}</span>
          {channel.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.logo} alt="" className="h-9 w-14 rounded-md bg-white/90 object-contain p-1" />
          )}
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold text-white">{channel.name}</p>
            <p className="text-[12px] text-white/60">
              {[channel.categories?.[0], channel.quality].filter(Boolean).join(" · ")}
              {state === "playing" && <span className="ml-2 inline-flex items-center gap-1 text-[#ff453a]">● LIVE</span>}
            </p>
          </div>
        </div>
      )}

      {channel && (
        <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} className="tv-glass flex h-10 w-10 items-center justify-center rounded-full text-white">
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button type="button" onClick={fullscreen} aria-label="Full screen" className="tv-glass flex h-10 w-10 items-center justify-center rounded-full text-white">
            <Maximize className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
