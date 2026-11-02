// Shared YouTube IFrame API loader.
//
// Several components used to assign window.onYouTubeIframeAPIReady directly,
// clobbering each other's callback so whichever mounted last "won" and the
// others never got a ready signal. This loader resolves a single shared
// promise and chains any callback that was already installed.

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

let ytPromise: Promise<any> | null = null;

// ---------------------------------------------------------------------------
// Audio focus: only ONE trailer may be audible at a time.
//
// Home and Library show several trailer players at once (hero slider, video
// widgets, hover previews...), each autoplaying with sound. Every YT.Player is
// wrapped once here, whichever component creates it:
// - when a player starts playing unmuted, or is unmuted, all others are muted;
// - a player scrolled mostly out of view is muted, and gets its sound back
//   when it is scrolled into view again (if it was audible before).
// ---------------------------------------------------------------------------
const players = new Set<any>();
const autoMuted = new WeakSet<any>();
let observer: IntersectionObserver | null = null;
const byFrame = new WeakMap<Element, any>();

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function silenceOthers(owner: any) {
  players.forEach((p) => {
    if (p === owner) return;
    if (safe(() => p.isMuted?.()) === false) {
      safe(() => p.mute());
      autoMuted.add(p);
    }
  });
}

function visibilityObserver(): IntersectionObserver | null {
  if (observer || typeof IntersectionObserver === "undefined") return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const p = byFrame.get(e.target);
        if (!p || !players.has(p)) continue;
        const playing = safe(() => p.getPlayerState?.()) === 1;
        if (e.intersectionRatio < 0.35) {
          if (safe(() => p.isMuted?.()) === false) {
            safe(() => p.mute());
            autoMuted.add(p);
          }
        } else if (e.intersectionRatio >= 0.6 && autoMuted.has(p) && playing) {
          autoMuted.delete(p);
          silenceOthers(p);
          safe(() => p.unMute());
        }
      }
    },
    { threshold: [0, 0.35, 0.6, 1] }
  );
  return observer;
}

function installAudioFocus(YT: any) {
  if (!YT?.Player || YT.Player.__hfxAudioFocus) return;
  const Original = YT.Player;
  function Player(this: any, el: any, opts: any = {}) {
    const events = { ...(opts.events || {}) };
    const userReady = events.onReady;
    const userState = events.onStateChange;
    let self: any = null;
    events.onReady = (e: any) => {
      const p = e.target;
      // Unmuting through the component's own toggle takes the focus too.
      const unMute = p.unMute?.bind(p);
      if (unMute && !p.__hfxWrapped) {
        p.__hfxWrapped = true;
        p.unMute = () => {
          silenceOthers(p);
          autoMuted.delete(p);
          return unMute();
        };
      }
      const frame = safe(() => p.getIframe?.());
      if (frame) {
        byFrame.set(frame, p);
        visibilityObserver()?.observe(frame);
      }
      userReady?.(e);
    };
    events.onStateChange = (e: any) => {
      if (e.data === 1 && safe(() => e.target.isMuted?.()) === false) silenceOthers(e.target);
      userState?.(e);
    };
    self = new Original(el, { ...opts, events });
    players.add(self);
    const destroy = self.destroy?.bind(self);
    self.destroy = () => {
      players.delete(self);
      const frame = safe(() => self.getIframe?.());
      if (frame) observer?.unobserve(frame);
      return destroy?.();
    };
    return self;
  }
  Player.prototype = Original.prototype;
  (Player as any).__hfxAudioFocus = true;
  YT.Player = Player;
}

// Players whose iframe left the page without destroy() (component unmounted).
if (typeof window !== "undefined") {
  setInterval(() => {
    players.forEach((p) => {
      const frame = safe(() => p.getIframe?.());
      if (!frame || !frame.isConnected) {
        safe(() => p.stopVideo?.());
        players.delete(p);
      }
    });
  }, 3000);
}

/** Mute every trailer on the page (e.g. when a video pop-up opens). */
export function muteAllTrailers() {
  silenceOthers(null);
}

export function loadYouTubeAPI(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT && window.YT.Player) {
    installAudioFocus(window.YT);
    return Promise.resolve(window.YT);
  }
  if (ytPromise) return ytPromise;

  ytPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        previous?.();
      } catch (e) {
        console.warn("Previous onYouTubeIframeAPIReady handler failed:", e);
      }
      installAudioFocus(window.YT);
      resolve(window.YT);
    };

    // Another component may already have injected the script; poll as a
    // fallback in case its ready event fired before we hooked in.
    const poll = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(poll);
        installAudioFocus(window.YT);
        resolve(window.YT);
      }
    }, 200);
    setTimeout(() => {
      clearInterval(poll);
      if (!(window.YT && window.YT.Player)) {
        ytPromise = null; // allow a retry later
        reject(new Error("YouTube IFrame API failed to load"));
      }
    }, 15000);

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.head.appendChild(tag);
    }
  });

  return ytPromise;
}

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export const extractYouTubeKey = (url?: string | null): string | null => {
  if (!url) return null;
  const patterns = [
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};
