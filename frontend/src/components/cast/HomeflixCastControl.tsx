"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cast, Check, Loader2, Pause, Play, RotateCcw, Square, Tv, X } from "lucide-react";
import { CastMediaRef, useHomeflixCast } from "@/hooks/useHomeflixCast";

export type HomeflixCast = ReturnType<typeof useHomeflixCast>;

interface HomeflixCastControlProps {
  /** Session state from useHomeflixCast(), owned by the player so it
   * survives the controls bar hiding. */
  cast: HomeflixCast;
  media: CastMediaRef;
  /** Current local playback position (seconds). */
  getCurrentTime: () => number;
  /** Called once a TV confirms playback: pause the local player. */
  onCastStart: () => void;
  /** Called when casting ends: resume locally at `position`. */
  onCastEnd: (position: number) => void;
  /** Existing Chromecast integration, offered in the same menu. */
  chromecast?: { available: boolean; connected: boolean; deviceName?: string | null; onClick: () => void };
  className?: string;
}

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};

/**
 * Cast button + device picker + remote. Lists HomeFlix TV apps connected to
 * this server (and Chromecast when the browser supports it). While casting,
 * shows a remote bar: play/pause, seek, stop, "watch here".
 */
export default function HomeflixCastControl({
  cast,
  media,
  getCurrentTime,
  onCastStart,
  onCastEnd,
  chromecast,
  className = "",
}: HomeflixCastControlProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { refreshDevices } = cast;

  // Refresh the device list while the picker is open.
  useEffect(() => {
    if (!open) return;
    refreshDevices();
    const t = setInterval(refreshDevices, 5000);
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      clearInterval(t);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refreshDevices]);

  const castingHere = !!cast.session;
  const active = castingHere || chromecast?.connected;

  const pick = async (deviceId: string) => {
    const device = cast.devices.find((d) => d.id === deviceId);
    if (!device) return;
    const ok = await cast.castTo(device, media, getCurrentTime());
    if (ok) {
      setOpen(false);
      onCastStart();
    }
  };

  const stopAndResumeHere = async () => {
    const pos = await cast.endSession(true);
    onCastEnd(pos);
  };

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={castingHere ? `Casting to ${cast.session?.name}` : "Cast to TV"}
        className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
          active ? "border-white/60 bg-white text-black" : "border-white/20 bg-black/50 text-white hover:bg-white/15"
        }`}
      >
        {cast.busy ? <Loader2 className="h-5 w-5 animate-spin" /> : castingHere ? <Tv className="h-5 w-5" /> : <Cast className="h-5 w-5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 z-[70] mb-3 w-72 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/90 p-2 text-white shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <p className="text-sm font-semibold">Play on TV</p>
              {cast.loadingDevices && <Loader2 className="h-4 w-4 animate-spin text-white/50" />}
            </div>

            {cast.devices.length === 0 && !cast.loadingDevices && (
              <p className="px-2 pb-3 text-[13px] leading-snug text-white/60">
                No TVs found. Open the HomeFlix app on your TV (connected to this server), then try again.
              </p>
            )}

            {cast.devices.map((d) => {
              const isCurrent = cast.session?.id === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="menuitem"
                  disabled={!d.online || cast.busy}
                  onClick={() => (isCurrent ? stopAndResumeHere() : pick(d.id))}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                    <Tv className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{d.name}</span>
                    <span className="block truncate text-[12px] text-white/50">
                      {isCurrent ? "Playing · tap to stop" : d.online ? (d.status?.title ? `Playing ${d.status.title}` : "Ready") : "Offline"}
                    </span>
                  </span>
                  {isCurrent && <Check className="h-4 w-4" />}
                </button>
              );
            })}

            {chromecast?.available && (
              <>
                <div className="mx-2 my-1 h-px bg-white/10" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    chromecast.onClick();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/10"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                    <Cast className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">
                      {chromecast.connected ? `Chromecast · ${chromecast.deviceName || "connected"}` : "Chromecast"}
                    </span>
                    <span className="block text-[12px] text-white/50">{chromecast.connected ? "Tap to disconnect" : "Google Cast devices"}</span>
                  </span>
                </button>
              </>
            )}

            {cast.error && (
              <p className="mx-2 mt-1 rounded-lg bg-red-500/15 px-2 py-1.5 text-[12px] text-red-200">{cast.error}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <span className="sr-only" aria-live="polite">
        {castingHere ? `Casting to ${cast.session?.name}` : ""}
      </span>
      {/* close X for menus on very small screens */}
      {open && (
        <button type="button" onClick={() => setOpen(false)} className="sr-only">
          <X /> Close
        </button>
      )}
    </div>
  );
}

/**
 * Remote bar shown while a HomeFlix TV is playing. Render it where it stays
 * mounted (not inside auto-hiding controls).
 */
export function HomeflixCastRemote({
  cast,
  media,
  onCastEnd,
}: {
  cast: HomeflixCast;
  media: CastMediaRef;
  onCastEnd: (position: number) => void;
}) {
  const [scrub, setScrub] = useState<number | null>(null);
  const castingHere = !!cast.session;
  const st = cast.status;
  const duration = st?.duration || 0;
  const position = scrub ?? st?.position ?? 0;
  const playing = st?.state === "playing" || st?.state === "buffering" || st?.state === "loading";

  // TV reached the end: hand control back to this device.
  useEffect(() => {
    if (cast.session && st?.state === "ended") {
      cast.endSession(false).then(() => onCastEnd(-1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.state]);

  const stopAndResumeHere = async () => {
    const pos = await cast.endSession(true);
    onCastEnd(pos);
  };

  return (
    <>
      {/* Remote bar while a HomeFlix TV is playing */}
      <AnimatePresence>
        {castingHere && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-0 z-[65] flex justify-center p-4"
          >
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900/85 p-4 text-white shadow-2xl backdrop-blur-2xl">
              <div className="mb-3 flex items-center gap-3">
                <Tv className="h-5 w-5 shrink-0 text-white/70" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{st?.title || media.title}</p>
                  <p className="text-[12px] text-white/55">
                    {st?.state === "error"
                      ? `Error on ${cast.session?.name}: ${st.error || "playback failed"}`
                      : `${st?.state === "loading" ? "Starting on" : "Playing on"} ${cast.session?.name}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => cast.command(playing ? "pause" : "resume")}
                  aria-label={playing ? "Pause on TV" : "Play on TV"}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black"
                >
                  {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
                </button>
                <button
                  type="button"
                  onClick={stopAndResumeHere}
                  title="Stop on TV and keep watching here"
                  className="flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-3 text-[13px] font-semibold hover:bg-white/25"
                >
                  <RotateCcw className="h-4 w-4" /> Watch here
                </button>
                <button
                  type="button"
                  onClick={() => cast.endSession(true).then(() => onCastEnd(-1))}
                  aria-label="Stop casting"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              </div>
              <div className="flex items-center gap-3 text-[12px] tabular-nums text-white/60">
                <span className="w-14 text-right">{fmt(position)}</span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, duration)}
                  step={1}
                  value={Math.min(position, Math.max(1, duration))}
                  disabled={!duration}
                  onChange={(e) => setScrub(Number(e.target.value))}
                  onMouseUp={() => {
                    if (scrub !== null) cast.command("seek", { position: scrub });
                    setScrub(null);
                  }}
                  onTouchEnd={() => {
                    if (scrub !== null) cast.command("seek", { position: scrub });
                    setScrub(null);
                  }}
                  onKeyUp={() => {
                    if (scrub !== null) cast.command("seek", { position: scrub });
                    setScrub(null);
                  }}
                  aria-label="Seek on TV"
                  className="h-1 flex-1 cursor-pointer accent-white"
                />
                <span className="w-14">{fmt(duration)}</span>
              </div>
              {cast.error && <p className="mt-2 text-[12px] text-red-300">{cast.error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
