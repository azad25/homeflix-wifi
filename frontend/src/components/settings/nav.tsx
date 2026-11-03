"use client";

import { createContext, useContext } from "react";

export type SectionId =
  | "dashboard"
  | "library"
  | "scanner"
  | "subtitles"
  | "downloads"
  | "autodownload"
  | "maintenance"
  | "storage"
  | "updates"
  | "server"
  | "livetv"
  | "pages"
  | "playback"
  | "security"
  | "notifications"
  | "about";

/** Old ?tab= values keep working. */
export const SECTION_ALIASES: Record<string, SectionId> = {
  system: "dashboard",
  media: "library",
  torrent: "downloads",
  paths: "storage",
  general: "playback",
  widgets: "pages",
  analytics: "maintenance",
  scanning: "scanner",
  scan: "scanner",
};

export const SettingsNavContext = createContext<(id: SectionId) => void>(() => {});
export const useSettingsNav = () => useContext(SettingsNavContext);
