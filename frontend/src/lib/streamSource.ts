import Hls from 'hls.js';
import { getApiUrl } from './api';

export interface StreamInfo {
  strategy: 'direct' | 'hls';
  url: string;
  segments?: 'ts' | 'fmp4';
  reason?: string;
  video_codec?: string;
  audio_codec?: string;
  container?: string;
  duration?: number;
}

export interface AttachedStream {
  strategy: 'direct' | 'hls';
  info: StreamInfo | null;
  /** Tear down hls.js internals; call before switching media or unmounting */
  destroy: () => void;
}

// Probe strings per server codec token. A codec counts as supported only on
// a definite "probably" from canPlayType (what progressive direct play
// uses), so the server never sends a file the browser will choke on.
const VIDEO_PROBES: Record<string, string> = {
  h264: 'video/mp4; codecs="avc1.640028"',
  hevc: 'video/mp4; codecs="hvc1.1.6.L120.90"',
  vp8: 'video/webm; codecs="vp8"',
  vp9: 'video/webm; codecs="vp9"',
  av1: 'video/mp4; codecs="av01.0.08M.08"',
};
// 10-bit variants (HEVC Main10, VP9 profile 2, AV1 10-bit)
const HIGH_BIT_DEPTH_PROBES: Record<string, string> = {
  hevc: 'video/mp4; codecs="hvc1.2.4.L120.90"',
  vp9: 'video/mp4; codecs="vp09.02.40.10"',
  av1: 'video/mp4; codecs="av01.0.08M.10"',
};
const AUDIO_PROBES: Record<string, string> = {
  aac: 'audio/mp4; codecs="mp4a.40.2"',
  mp3: 'audio/mpeg',
  opus: 'audio/webm; codecs="opus"',
  vorbis: 'audio/webm; codecs="vorbis"',
  flac: 'audio/flac',
  ac3: 'audio/mp4; codecs="ac-3"',
  eac3: 'audio/mp4; codecs="ec-3"',
};
const CONTAINER_PROBES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  matroska: 'video/x-matroska; codecs="avc1.640028, mp4a.40.2"',
};

let cachedCaps: string | null = null;

/**
 * Measure what this browser decodes natively and encode it as query params
 * for /stream/:id/info. This is how HEVC/AC3 direct-play on Safari, Edge and
 * hardware-HEVC Chrome instead of being transcoded, and how a browser that
 * lacks a codec gets HLS instead of a file that never starts.
 */
export function clientCapabilityQuery(): string {
  if (cachedCaps !== null) return cachedCaps;
  if (typeof document === 'undefined') return '';
  const probe = document.createElement('video');
  // HLS playback goes through MSE (hls.js), so a video codec only counts
  // if MSE accepts it too - otherwise the server would remux HEVC into
  // fMP4 for a browser that can only play it progressively.
  const mse: { isTypeSupported(t: string): boolean } | undefined =
    (window as any).MediaSource || (window as any).ManagedMediaSource;
  const supported = (table: Record<string, string>, loose = false, needMse = false) =>
    Object.keys(table)
      .filter((k) => {
        const r = probe.canPlayType(table[k]);
        const ok = r === 'probably' || (loose && r === 'maybe');
        return ok && (!needMse || !mse || mse.isTypeSupported(table[k]));
      })
      .join(',');

  const params = new URLSearchParams();
  const v = supported(VIDEO_PROBES, false, true);
  // Plain MIME types (no codecs) never return "probably"; accept "maybe"
  const a = supported(AUDIO_PROBES, true);
  const c = supported(CONTAINER_PROBES, true);
  // Only report when the probe produced something sensible; otherwise the
  // server falls back to its conservative web profile.
  if (v) params.set('vcodecs', v);
  if (a) params.set('acodecs', a);
  if (c) params.set('containers', c);
  params.set('hbd', supported(HIGH_BIT_DEPTH_PROBES, false, true) || 'none');
  cachedCaps = params.toString();
  return cachedCaps;
}

/**
 * Ask the backend how this media should be played for a web client.
 * The decision is a DB lookup server-side (no ffprobe), so this is fast.
 */
export async function fetchStreamInfo(
  mediaId: number,
  profile: 'web' | 'cast' = 'web',
  startPosition = 0,
): Promise<StreamInfo | null> {
  try {
    const params = new URLSearchParams(
      // The receiver is a different device: its own baseline, not our caps
      profile === 'web' ? clientCapabilityQuery() : '',
    );
    params.set('profile', profile);
    // Each player gets its own server-side encoder, so two viewers of the
    // same title never restart each other's stream
    params.set('sid', Math.random().toString(36).slice(2, 12));
    // Lets the server start encoding at the resume point right away
    if (startPosition > 0) params.set('start', String(Math.floor(startPosition)));
    const res = await fetch(`${getApiUrl()}/api/stream/${mediaId}/info?${params.toString()}`);
    if (!res.ok) return null;
    return (await res.json()) as StreamInfo;
  } catch {
    return null;
  }
}

/**
 * Tell the server this player is done so it frees the encoder (and its
 * NVENC slot) now instead of after the idle timeout.
 */
function releaseHlsSession(mediaId: number, playlistUrl: string) {
  try {
    const sid = new URL(playlistUrl).searchParams.get('sid');
    if (!sid) return;
    const url = `${getApiUrl()}/api/stream/${mediaId}/hls/release?sid=${encodeURIComponent(sid)}`;
    if (!navigator.sendBeacon?.(url)) {
      fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
    }
  } catch {
    // best effort - the server's idle janitor cleans up anyway
  }
}

/**
 * Attach the right source to a <video> element:
 * - direct-playable files get the plain progressive URL (kernel sendfile,
 *   native byte-range seeking)
 * - everything else gets HLS via hls.js (or Safari's native HLS), which the
 *   server produces with GPU transcoding - seekable on every file
 *
 * Falls back to the legacy direct URL if the info endpoint is unreachable.
 */
export async function attachStreamSource(
  video: HTMLVideoElement,
  mediaId: number,
  fallbackDirectUrl?: string,
  startPosition = 0,
): Promise<AttachedStream> {
  const info = await fetchStreamInfo(mediaId, 'web', startPosition);
  const apiUrl = getApiUrl();
  // Media fragment: the browser's first range request lands at the resume
  // point instead of fetching from 0 and seeking afterwards
  const fragment = startPosition > 0 ? `#t=${Math.floor(startPosition)}` : '';

  if (!info) {
    video.src = (fallbackDirectUrl || `${apiUrl}/api/stream/${mediaId}`) + fragment;
    video.load();
    return { strategy: 'direct', info: null, destroy: () => {} };
  }

  const absoluteUrl = info.url.startsWith('http') ? info.url : `${apiUrl}${info.url}`;

  if (info.strategy === 'hls') {
    if (Hls.isSupported()) {
      const hls = new Hls({
        // LAN: bandwidth is never the limit, the encoder is. Buffer a
        // generous minute ahead so encoder hiccups never reach the screen.
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 200 * 1000 * 1000,
        // Drop played media so long sessions on TVs don't run out of memory
        backBufferLength: 30,
        // Request the next segment while the current one is still parsing
        startFragPrefetch: true,
        // Segment production can take a moment after a seek (encoder restart)
        fragLoadingTimeOut: 45000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        // Start at the resume point: no wasted segment 0 + encoder restart
        startPosition: startPosition > 0 ? startPosition : -1,
      });
      // Recover instead of freezing on a decode or network hiccup
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        }
      });
      hls.loadSource(absoluteUrl);
      hls.attachMedia(video);
      // Tab closed or navigated away: React never unmounts, release anyway
      const onPageHide = () => releaseHlsSession(mediaId, absoluteUrl);
      window.addEventListener('pagehide', onPageHide);
      return {
        strategy: 'hls',
        info,
        destroy: () => {
          window.removeEventListener('pagehide', onPageHide);
          hls.destroy();
          releaseHlsSession(mediaId, absoluteUrl);
        },
      };
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari plays HLS natively
      video.src = absoluteUrl + fragment;
      video.load();
      return { strategy: 'hls', info, destroy: () => {} };
    }
    // No MSE, no native HLS - last resort: progressive URL
    video.src = `${apiUrl}/api/stream/${mediaId}${fragment}`;
    video.load();
    return { strategy: 'direct', info, destroy: () => {} };
  }

  video.src = absoluteUrl + fragment;
  video.load();
  return { strategy: 'direct', info, destroy: () => {} };
}
