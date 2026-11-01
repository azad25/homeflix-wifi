"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/lib/api";

// Cast to the HomeFlix TV app via the HomeFlix server (see
// docs/TV_CAST_PROTOCOL.md). Works in any browser on the LAN over HTTP.

export interface CastDevice {
  id: string;
  name: string;
  platform?: string;
  app_version?: string;
  online: boolean;
  last_seen: string;
  status?: CastStatus;
}

export interface CastStatus {
  state: "idle" | "loading" | "playing" | "paused" | "buffering" | "ended" | "error" | string;
  media_id?: number;
  media_type?: string;
  title?: string;
  position: number;
  duration: number;
  volume?: number;
  muted?: boolean;
  error?: string;
  updated_at?: string;
}

export interface CastMediaRef {
  id: number;
  type: "movie" | "episode";
  title?: string;
  series_id?: number;
  season?: number;
  episode?: number;
  poster?: string;
  backdrop?: string;
}

type Action = "play" | "pause" | "resume" | "seek" | "stop" | "volume" | "subtitle";

const senderLabel = () => {
  if (typeof navigator === "undefined") return "Web";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "";
  return os ? `${browser} on ${os}` : browser;
};

export function useHomeflixCast() {
  const [devices, setDevices] = useState<CastDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [session, setSession] = useState<CastDevice | null>(null);
  const [status, setStatus] = useState<CastStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshDevices = useCallback(async () => {
    setLoadingDevices(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/cast/devices`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setDevices(Array.isArray(data?.devices) ? data.devices : []);
      }
    } catch {
      /* server unreachable */
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const listen = useCallback(
    (deviceId: string) => {
      stopListening();
      const base = getApiUrl();
      try {
        const es = new EventSource(`${base}/api/cast/devices/${encodeURIComponent(deviceId)}/events`);
        es.addEventListener("status", (e) => {
          try {
            setStatus(JSON.parse((e as MessageEvent).data));
          } catch {
            /* ignore */
          }
        });
        es.onerror = () => {
          // Proxies that buffer SSE: fall back to polling.
          if (!pollRef.current) {
            pollRef.current = setInterval(async () => {
              try {
                const r = await fetch(`${base}/api/cast/devices/${encodeURIComponent(deviceId)}/status`, { cache: "no-store" });
                if (r.ok) {
                  const d = await r.json();
                  if (d?.status) setStatus(d.status);
                  if (d && d.online === false) setError("The TV went offline");
                }
              } catch {
                /* ignore */
              }
            }, 2000);
          }
        };
        esRef.current = es;
      } catch {
        /* EventSource unsupported: polling only */
      }
    },
    [stopListening]
  );

  const send = useCallback(async (deviceId: string, action: Action, extra: Record<string, unknown> = {}) => {
    const res = await fetch(`${getApiUrl()}/api/cast/devices/${encodeURIComponent(deviceId)}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Cast-Sender": senderLabel() },
      body: JSON.stringify({ action, from: senderLabel(), ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error || `TV command failed (${res.status})`);
    }
    return data;
  }, []);

  /** Start playback of `media` on a TV at `position` seconds. */
  const castTo = useCallback(
    async (device: CastDevice, media: CastMediaRef, position: number) => {
      setBusy(true);
      setError(null);
      try {
        await send(device.id, "play", { media, position: Math.max(0, Math.floor(position)) });
        setSession(device);
        setStatus({ state: "loading", media_id: media.id, title: media.title, position, duration: 0 });
        listen(device.id);
        return true;
      } catch (e: any) {
        setError(e?.message || "Couldn't reach the TV");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [send, listen]
  );

  const command = useCallback(
    async (action: Exclude<Action, "play">, extra: Record<string, unknown> = {}) => {
      if (!session) return;
      try {
        await send(session.id, action, extra);
        setError(null);
      } catch (e: any) {
        setError(e?.message || "TV command failed");
      }
    },
    [session, send]
  );

  /** Stop casting. Returns the TV's last position so playback can resume locally. */
  const endSession = useCallback(
    async (stopTv = true) => {
      const last = status?.position ?? 0;
      if (session && stopTv) {
        try {
          await send(session.id, "stop");
        } catch {
          /* TV may already be gone */
        }
      }
      stopListening();
      setSession(null);
      setStatus(null);
      return last;
    },
    [session, status, send, stopListening]
  );

  useEffect(() => () => stopListening(), [stopListening]);

  return { devices, loadingDevices, refreshDevices, session, status, busy, error, setError, castTo, command, endSession };
}
