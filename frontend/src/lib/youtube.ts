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

export function loadYouTubeAPI(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytPromise) return ytPromise;

  ytPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        previous?.();
      } catch (e) {
        console.warn("Previous onYouTubeIframeAPIReady handler failed:", e);
      }
      resolve(window.YT);
    };

    // Another component may already have injected the script; poll as a
    // fallback in case its ready event fired before we hooked in.
    const poll = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(poll);
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
