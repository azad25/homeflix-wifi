"use client";

import { createContext, useContext } from "react";

export type SectionId =
  | "dashboard"
  | "library"
  | "subtitles"
  | "downloads"
  | "maintenance"
  | "storage"
  | "updates"
  | "server"
  | "livetv"
  | "pages"
  | "playback"
  | "security"
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
  scanning: "maintenance",
};

export const SettingsNavContext = createContext<(id: SectionId) => void>(() => {});
export const useSettingsNav = () => useContext(SettingsNavContext);
