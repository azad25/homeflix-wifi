"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  ChevronDown,
  ChevronUp,
  Heart,
  History,
  LayoutList,
  Loader2,
  Maximize,
  Minimize,
  Tv,
  Volume1,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { muteAllTrailers } from "@/lib/youtube";

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

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function Logo({ ch, className }: { ch: LiveChannel; className: string }) {
  const [bad, setBad] = useState(false);
  return (
    <span className={`flex items-center justify-center overflow-hidden rounded-md bg-white/90 ${className}`}>
      {ch.logo && !bad ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ch.logo} alt="" className="h-full w-full object-contain p-1" onError={() => setBad(true)} />
      ) : (
        <Tv className="h-1/2 w-1/2 text-black/50" />
      )}
    </span>
  );
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Live TV stage: HLS playback with source failover plus a TV-style UI that
 * works windowed and full screen (info banner, channel guide, number entry,
 * channel up/down, last channel, volume, auto-hiding controls, swipe).
 */
export default function LivePlayer({
  channel,
  channels,
  onTune,
  favorites = [],
  onToggleFavorite,
}: {
  channel: LiveChannel | null;
  /** The list channel up/down moves through (current filter). */
  channels: LiveChannel[];
  onTune: (ch: LiveChannel) => void;
  favorites?: string[];
  onToggleFavorite?: (id: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("idle");
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFull, setIsFull] = useState(false);
  const [banner, setBanner] = useState(false);
  const [chrome, setChrome] = useState(true); // on-screen controls
  const [guide, setGuide] = useState(false);
  const [guideIdx, setGuideIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [volumeHud, setVolumeHud] = useState(false);
  // Broadcaster's official YouTube live stream (when no direct stream plays).
  const [youtube, setYoutube] = useState<string | null>(null);
  const ytRef = useRef<HTMLIFrameElement>(null);
  const lastRef = useRef<LiveChannel | null>(null);
  const prevChannelRef = useRef<LiveChannel | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const touchY = useRef<number | null>(null);
  const clock = useClock();

  const later = (key: string, fn: () => void, ms: number) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  };
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const poke = useCallback(() => {
    setChrome(true);
    later("chrome", () => setChrome(false), 3500);
  }, []);

  // Remember the previous channel for "Last" (Backspace).
  useEffect(() => {
    if (!channel) return;
    if (lastRef.current && lastRef.current.id !== channel.id) prevChannelRef.current = lastRef.current;
    lastRef.current = channel;
    setBanner(true);
    later("banner", () => setBanner(false), 4500);
  }, [channel]);

  // ---- playback ----
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel) return;
    let cancelled = false;
    let sources: string[] = [];
    let youtubeId = "";
    let idx = 0;
    setState("loading");
    setYoutube(null);

    const destroy = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    const tryNext = () => {
      if (cancelled) return;
      destroy();
      if (idx >= sources.length) {
        if (youtubeId) {
          video.removeAttribute("src");
          muteAllTrailers();
          setYoutube(youtubeId);
          return;
        }
        setState("failed");
        return;
      }
      const src = sources[idx++];
      const url = src.startsWith("http") ? src : `${getApiUrl()}${src}`;
      if (Hls.isSupported()) {
        const hls = new Hls({
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
          tryNext();
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
        youtubeId = typeof data?.youtube_id === "string" ? data.youtube_id : "";
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
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.onerror = null;
      destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [channel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.muted = muted;
      v.volume = volume;
    }
    // Same controls for the YouTube player (IFrame API commands).
    const send = (func: string, args: unknown[] = []) =>
      ytRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
    if (youtube) {
      send(muted ? "mute" : "unMute");
      send("setVolume", [Math.round(volume * 100)]);
    }
  }, [muted, volume, youtube]);

  // ---- full screen ----
  useEffect(() => {
    const onFs = () => setIsFull(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else stageRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  // ---- channel actions ----
  const zap = useCallback(
    (dir: 1 | -1) => {
      if (!channels.length) return;
      const i = channel ? channels.findIndex((c) => c.id === channel.id) : -1;
      onTune(channels[(i + dir + channels.length) % channels.length]);
    },
    [channels, channel, onTune]
  );
  const openGuide = useCallback(() => {
    const i = channel ? channels.findIndex((c) => c.id === channel.id) : 0;
    setGuideIdx(Math.max(0, i));
    setGuide(true);
  }, [channel, channels]);
  const changeVolume = (d: number) => {
    setMuted(false);
    setVolume((v) => Math.min(1, Math.max(0, Math.round((v + d) * 10) / 10)));
    setVolumeHud(true);
    later("vol", () => setVolumeHud(false), 1500);
  };

  // Guide keeps the highlighted row visible.
  useEffect(() => {
    if (!guide) return;
    stageRef.current?.querySelector(`[data-gi="${guideIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [guide, guideIdx]);

  // ---- remote control keys ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      // Plain arrows act like a remote only in full screen or when the
      // stage has focus; PgUp/PgDn work everywhere.
      const remote = isFull || stageRef.current?.contains(document.activeElement);
      poke();
      if (guide) {
        if (e.key === "ArrowDown") setGuideIdx((i) => Math.min(channels.length - 1, i + 1));
        else if (e.key === "ArrowUp") setGuideIdx((i) => Math.max(0, i - 1));
        else if (e.key === "PageDown") setGuideIdx((i) => Math.min(channels.length - 1, i + 8));
        else if (e.key === "PageUp") setGuideIdx((i) => Math.max(0, i - 8));
        else if (e.key === "Enter") {
          if (channels[guideIdx]) onTune(channels[guideIdx]);
          setGuide(false);
        } else if (e.key === "Escape" || e.key === "ArrowRight" || e.key === "Backspace") setGuide(false);
        else return;
        e.preventDefault();
        return;
      }
      if (e.key === "PageUp" || e.key === "ChannelUp" || (remote && e.key === "ArrowUp")) zap(-1);
      else if (e.key === "PageDown" || e.key === "ChannelDown" || (remote && e.key === "ArrowDown")) zap(1);
      else if (remote && (e.key === "Enter" || e.key === "ArrowLeft" || e.key === "g")) openGuide();
      else if (e.key === "f" || e.key === "F") toggleFull();
      else if (e.key === "m" || e.key === "M") setMuted((m) => !m);
      else if (e.key === "+" || e.key === "=" || e.key === "AudioVolumeUp") changeVolume(0.1);
      else if (e.key === "-" || e.key === "_" || e.key === "AudioVolumeDown") changeVolume(-0.1);
      else if (e.key === "i" || e.key === "I") {
        setBanner(true);
        later("banner", () => setBanner(false), 4500);
      } else if (e.key === "Backspace" && prevChannelRef.current) onTune(prevChannelRef.current);
      else if (/^[0-9]$/.test(e.key)) {
        const next = (typed + e.key).slice(-4);
        setTyped(next);
        later(
          "typed",
          () => {
            const ch = channels.find((c) => c.number === parseInt(next, 10));
            if (ch) onTune(ch);
            setTyped("");
          },
          1300
        );
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guide, guideIdx, channels, isFull, typed, zap, openGuide, toggleFull, onTune, poke]); // eslint-disable-line react-hooks/exhaustive-deps

  const fav = channel ? favorites.includes(channel.id) : false;
  const showChrome = chrome || state !== "playing" || !channel;
  const big = isFull;

  return (
    <div
      ref={stageRef}
      tabIndex={0}
      onMouseMove={poke}
      onClick={poke}
      onDoubleClick={toggleFull}
      onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
      onTouchEnd={(e) => {
        if (touchY.current == null) return;
        const dy = e.changedTouches[0].clientY - touchY.current;
        touchY.current = null;
        if (Math.abs(dy) > 60) zap(dy < 0 ? 1 : -1); // swipe up = next channel
      }}
      className={`relative w-full select-none overflow-hidden bg-black outline-none ${
        isFull ? "h-full" : "aspect-video rounded-2xl ring-1 ring-white/[0.08] focus-visible:ring-white/40"
      } ${showChrome ? "cursor-default" : "cursor-none"}`}
    >
      <video ref={videoRef} className="h-full w-full bg-black object-contain" playsInline autoPlay />

      {youtube && (
        // Official live stream from the broadcaster's YouTube channel. Pointer
        // events stay on the stage so the TV controls and keys keep working.
        <iframe
          ref={ytRef}
          key={youtube}
          src={`https://www.youtube-nocookie.com/embed/${youtube}?autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&iv_load_policy=3`}
          title={channel?.name || "Live"}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          onLoad={() => {
            setState("playing");
            ytRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening" }), "*");
          }}
          className="pointer-events-none absolute inset-0 h-full w-full border-0"
        />
      )}

      {!channel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/55">
          <Tv className="h-10 w-10" />
          <p className="text-[15px]">Pick a channel to start watching</p>
        </div>
      )}

      {/* Tuning: logo + spinner like a set-top box */}
      {channel && state === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <Logo ch={channel} className={big ? "h-20 w-32" : "h-12 w-20"} />
          <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        </div>
      )}

      {channel && state === "failed" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 px-6 text-center">
          <WifiOff className="h-9 w-9 text-white/50" />
          <p className="text-[16px] font-semibold text-white">{channel.name} isn&apos;t available right now</p>
          <p className="text-[13px] text-white/55">The broadcaster may be offline or block this region. Press ▲ / ▼ for another channel.</p>
        </div>
      )}

      {/* Number entry */}
      {typed && (
        <div className={`absolute right-5 top-5 rounded-xl bg-black/70 px-4 py-2 font-mono font-bold tabular-nums text-white ring-1 ring-white/15 ${big ? "text-5xl" : "text-3xl"}`}>
          {typed}
          <span className="animate-pulse">_</span>
        </div>
      )}

      {/* Volume HUD */}
      {volumeHud && (
        <div className="absolute left-1/2 top-6 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/70 px-4 py-2 ring-1 ring-white/15">
          {muted || volume === 0 ? <VolumeX className="h-5 w-5 text-white" /> : <Volume2 className="h-5 w-5 text-white" />}
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-white" style={{ width: `${(muted ? 0 : volume) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Info banner (bottom, like a TV) */}
      {channel && (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-5 pb-5 pt-16 transition-all duration-300 md:px-8 md:pb-7 ${
            banner || showChrome ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <div className="flex items-end gap-4">
            <span className={`rounded-lg bg-white/15 px-3 py-1 font-mono font-bold tabular-nums text-white ${big ? "text-3xl" : "text-xl"}`}>{channel.number}</span>
            <Logo ch={channel} className={big ? "h-16 w-24" : "h-11 w-16"} />
            <div className="min-w-0 flex-1">
              <p className={`truncate font-semibold text-white ${big ? "text-3xl" : "text-[19px]"}`}>{channel.name}</p>
              <p className={`flex flex-wrap items-center gap-x-2 text-white/65 ${big ? "text-[16px]" : "text-[13px]"}`}>
                {state === "playing" && (
                  <span className="flex items-center gap-1 font-semibold text-[#ff453a]">
                    <span className="h-2 w-2 rounded-full bg-[#ff453a]" /> LIVE
                  </span>
                )}
                {[cap(channel.categories?.[0]), youtube ? "via YouTube" : channel.quality, channel.country].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className={`shrink-0 font-semibold tabular-nums text-white/85 ${big ? "text-2xl" : "text-[15px]"}`}>{clock}</span>
          </div>
        </div>
      )}

      {/* On-screen controls */}
      {channel && (
        <div className={`absolute right-3 top-3 flex items-center gap-2 transition-opacity duration-300 md:right-5 md:top-5 ${showChrome && !guide ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <Ctl label="Channel guide (Enter)" onClick={openGuide}>
            <LayoutList className="h-5 w-5" />
          </Ctl>
          <Ctl label="Previous channel (▲)" onClick={() => zap(-1)}>
            <ChevronUp className="h-5 w-5" />
          </Ctl>
          <Ctl label="Next channel (▼)" onClick={() => zap(1)}>
            <ChevronDown className="h-5 w-5" />
          </Ctl>
          {prevChannelRef.current && (
            <Ctl label="Last channel (Backspace)" onClick={() => prevChannelRef.current && onTune(prevChannelRef.current)}>
              <History className="h-5 w-5" />
            </Ctl>
          )}
          {onToggleFavorite && (
            <Ctl label={fav ? "Remove favorite" : "Add favorite"} onClick={() => onToggleFavorite(channel.id)}>
              <Heart className={`h-5 w-5 ${fav ? "fill-current text-[#ff453a]" : ""}`} />
            </Ctl>
          )}
          <div className="group/vol flex items-center rounded-full bg-black/55 ring-1 ring-white/15 backdrop-blur-md">
            <button type="button" onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }} aria-label={muted ? "Unmute (M)" : "Mute (M)"} className="flex h-10 w-10 items-center justify-center text-white">
              {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : volume < 0.5 ? <Volume1 className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                setMuted(false);
                setVolume(parseFloat(e.target.value));
              }}
              aria-label="Volume"
              className="mr-3 hidden w-0 accent-white transition-all duration-200 group-hover/vol:block group-hover/vol:w-24"
            />
          </div>
          <Ctl label={isFull ? "Exit full screen (F)" : "Full screen (F)"} onClick={toggleFull}>
            {isFull ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Ctl>
        </div>
      )}

      {/* Channel guide overlay */}
      <div
        className={`absolute inset-y-0 left-0 z-10 flex w-[min(420px,85%)] flex-col bg-black/85 ring-1 ring-white/10 backdrop-blur-xl transition-[transform,visibility] duration-300 ${guide ? "visible translate-x-0" : "invisible -translate-x-full"}`}
        aria-hidden={!guide}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className={`font-semibold text-white ${big ? "text-2xl" : "text-[17px]"}`}>Channels</p>
            <p className="text-[12px] text-white/45">▲▼ choose · Enter watch · Esc close</p>
          </div>
          <button type="button" onClick={() => setGuide(false)} aria-label="Close guide" className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pb-4">
          {channels.map((c, i) => {
            const active = channel?.id === c.id;
            const hi = i === guideIdx;
            return (
              <button
                key={c.id}
                data-gi={i}
                type="button"
                onMouseEnter={() => setGuideIdx(i)}
                onClick={() => {
                  onTune(c);
                  setGuide(false);
                }}
                className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${hi ? "bg-white text-black" : "text-white"}`}
              >
                <span className={`w-10 shrink-0 text-right font-mono tabular-nums ${big ? "text-[17px]" : "text-[13px]"} ${hi ? "text-black/55" : "text-white/45"}`}>{c.number}</span>
                <Logo ch={c} className={big ? "h-11 w-16" : "h-9 w-14"} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-semibold ${big ? "text-[18px]" : "text-[14px]"}`}>{c.name}</span>
                  <span className={`block truncate text-[12px] ${hi ? "text-black/55" : "text-white/45"}`}>{[cap(c.categories?.[0]), c.quality].filter(Boolean).join(" · ")}</span>
                </span>
                {active && <span className={`text-[11px] font-bold ${hi ? "text-[#d70015]" : "text-[#ff453a]"}`}>● NOW</span>}
                {favorites.includes(c.id) && <Heart className="h-3.5 w-3.5 shrink-0 fill-current text-[#ff453a]" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Ctl({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/20"
    >
      {children}
    </button>
  );
}
