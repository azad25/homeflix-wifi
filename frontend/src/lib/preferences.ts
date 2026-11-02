"use client";

import { useSyncExternalStore } from "react";

// Per-device viewing preferences (Settings > Playback). Stored in
// localStorage; components read them with usePreference and update live.

export interface Preferences {
  /** Start the next episode automatically when one ends. */
  autoplayNext: boolean;
  /** Play trailers / preview clips while browsing (heroes, hovered cards). */
  autoplayPreviews: boolean;
  /** Default playback speed for new videos. */
  playbackRate: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  autoplayNext: true,
  autoplayPreviews: true,
  playbackRate: 1,
};

const KEY = "homeflix_prefs";
const EVENT = "homeflix-prefs";
let cache: Preferences | null = null;

function read(): Preferences {
  if (cache) return cache;
  let stored: Partial<Preferences> = {};
  try {
    stored = JSON.parse(window.localStorage.getItem(KEY) || "{}") || {};
  } catch {
    /* storage unavailable or corrupt */
  }
  cache = { ...DEFAULT_PREFERENCES, ...stored };
  return cache;
}

export function getPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  return read();
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  if (typeof window === "undefined") return;
  cache = { ...read(), [key]: value };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* private mode: keep the in-memory value */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null; // changed in another tab
      onChange();
    }
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePreference<K extends keyof Preferences>(key: K): Preferences[K] {
  return useSyncExternalStore(
    subscribe,
    () => read()[key],
    () => DEFAULT_PREFERENCES[key]
  );
}
