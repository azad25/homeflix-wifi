"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutGrid,
  Library,
  Captions,
  Download,
  Wrench,
  HardDrive,
  ArrowUpCircle,
  Server,
  PanelsTopLeft,
  PlayCircle,
  Lock,
  Info,
  Menu,
  X,
  ListChecks,
  ChevronLeft,
  Radio,
  Sparkles,
  Bell,
} from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ActivityPanel, ActivityProvider, useActivity } from "./activity";
import { SECTION_ALIASES, SectionId, SettingsNavContext } from "./nav";
import { fetchUpdateInfo } from "./sections/UpdatesSection";
import { Notice, Button } from "./ui";

// Each section is its own chunk: opening Settings no longer downloads the
// library manager, torrent client, server monitor and page builder at once.
const loading = () => <SectionSkeleton />;
const LibraryWorkspace = dynamic(() => import("./sections/LibraryWorkspace"), { loading });
const SECTIONS: Record<SectionId, React.ComponentType<any>> = {
  dashboard: dynamic(() => import("./sections/DashboardSection"), { loading }),
  library: LibraryWorkspace,
  subtitles: LibraryWorkspace,
  downloads: dynamic(() => import("./sections/DownloadsSection"), { loading }),
  autodownload: dynamic(() => import("./sections/AutoDownloadSection"), { loading }),
  notifications: dynamic(() => import("./sections/NotificationsSection"), { loading }),
  maintenance: dynamic(() => import("./sections/MaintenanceSection"), { loading }),
  storage: dynamic(() => import("./sections/StorageSection"), { loading }),
  updates: dynamic(() => import("./sections/UpdatesSection"), { loading }),
  server: dynamic(() => import("./sections/ServerSection"), { loading }),
  livetv: dynamic(() => import("./sections/LiveTVSection"), { loading }),
  pages: dynamic(() => import("./sections/PagesSection"), { loading }),
  playback: dynamic(() => import("./sections/PlaybackSection"), { loading }),
  security: dynamic(() => import("./sections/SecuritySection"), { loading }),
  about: dynamic(() => import("./sections/AboutSection"), { loading }),
};

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
}

const NAV: { title?: string; items: NavItem[] }[] = [
  { items: [{ id: "dashboard", label: "Dashboard", icon: <LayoutGrid /> }] },
  {
    title: "Library",
    items: [
      { id: "library", label: "Library Manager", icon: <Library /> },
      { id: "subtitles", label: "Subtitles", icon: <Captions /> },
      { id: "downloads", label: "Downloads", icon: <Download /> },
      { id: "autodownload", label: "Auto Download", icon: <Sparkles /> },
      { id: "maintenance", label: "Maintenance", icon: <Wrench /> },
    ],
  },
  {
    title: "Server",
    items: [
      { id: "storage", label: "Storage", icon: <HardDrive /> },
      { id: "updates", label: "Software Update", icon: <ArrowUpCircle /> },
      { id: "livetv", label: "Live TV", icon: <Radio /> },
      { id: "server", label: "Server Monitor", icon: <Server /> },
      { id: "pages", label: "Pages", icon: <PanelsTopLeft /> },
    ],
  },
  {
    title: "Preferences",
    items: [
      { id: "playback", label: "Playback", icon: <PlayCircle /> },
      { id: "notifications", label: "Notifications", icon: <Bell /> },
      { id: "security", label: "Security", icon: <Lock /> },
      { id: "about", label: "About", icon: <Info /> },
    ],
  },
];

const ALL_IDS = NAV.flatMap((g) => g.items.map((i) => i.id));
const resolve = (tab: string | null | undefined): SectionId => {
  if (!tab) return "dashboard";
  if ((ALL_IDS as string[]).includes(tab)) return tab as SectionId;
  return SECTION_ALIASES[tab] || "dashboard";
};

/** Poll while the page is visible. */
function useVisiblePoll(fn: () => void, ms: number) {
  useEffect(() => {
    fn();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") fn();
    }, ms);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms]);
}

export default function SettingsShell() {
  return (
    <ActivityProvider>
      <Shell />
    </ActivityProvider>
  );
}

function Shell() {
  usePageTitle("Settings");
  const router = useRouter();
  const params = useSearchParams();
  const [section, setSection] = useState<SectionId>(() => resolve(params?.get("tab")));
  const [drawer, setDrawer] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const { unread } = useActivity();

  // Sidebar badges
  const [updateBadge, setUpdateBadge] = useState(false);
  const [downloading, setDownloading] = useState(0);
  const [lowStorage, setLowStorage] = useState<any[]>([]);
  const [storageDismissed, setStorageDismissed] = useState(false);

  useEffect(() => {
    fetchUpdateInfo().then((u) => setUpdateBadge(!!(u?.ok && (u.update_available || u.upgrade?.branch))));
  }, []);
  useVisiblePoll(() => {
    fetch(`${getApiUrl()}/api/torrents/downloads`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDownloading(Array.isArray(d?.downloads) ? d.downloads.filter((x: any) => x.status === "downloading").length : 0))
      .catch(() => {});
  }, 15000);
  useVisiblePoll(() => {
    fetch(`${getApiUrl()}/api/admin/storage/stats`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setLowStorage(s?.low_alerts || []))
      .catch(() => {});
  }, 60000);

  // Back/forward and external links that change ?tab=
  const tabParam = params?.get("tab");
  useEffect(() => {
    setSection(resolve(tabParam));
  }, [tabParam]);

  const go = useCallback(
    (id: SectionId) => {
      setSection(id);
      setDrawer(false);
      const qs = new URLSearchParams(params?.toString() || "");
      qs.set("tab", id);
      // A media deep link only applies to the section it was opened for.
      if (id !== "library" && id !== "subtitles" && id !== "downloads") qs.delete("media");
      router.replace(`/settings?${qs.toString()}`, { scroll: false });
      document.getElementById("settings-scroll")?.scrollTo({ top: 0 });
    },
    [params, router]
  );

  const badges: Partial<Record<SectionId, React.ReactNode>> = useMemo(
    () => ({
      updates: updateBadge ? <span className="h-2 w-2 rounded-full bg-info" aria-label="Update available" /> : null,
      downloads: downloading ? <span className="text-[12px] font-semibold tabular-nums text-white/55">{downloading}</span> : null,
      storage: lowStorage.length ? <span className="h-2 w-2 rounded-full bg-danger" aria-label="Low storage" /> : null,
    }),
    [updateBadge, downloading, lowStorage.length]
  );

  const current = NAV.flatMap((g) => g.items).find((i) => i.id === section)!;
  // Library and Subtitles share one workspace (same selected title), so
  // keep one instance mounted while switching between them.
  const Section = SECTIONS[section];
  const sectionKey = section === "subtitles" ? "library" : section;
  const sectionProps = section === "library" ? { view: "media" } : section === "subtitles" ? { view: "subtitles" } : {};

  const sidebar = (
    <nav aria-label="Settings" className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-4 pt-6">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-white/80 transition-colors hover:bg-white/[0.16] hover:text-white"
          aria-label="Back to HomeFlix"
          title="Back to HomeFlix"
        >
          <ChevronLeft className="h-[18px] w-[18px]" />
        </button>
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-white">Settings</h1>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-6 [scrollbar-width:thin]">
        {NAV.map((group, gi) => (
          <div key={gi}>
            {group.title && <p className="mb-1 px-3 text-[12px] font-semibold text-white/35">{group.title}</p>}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.id === section;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => go(item.id)}
                      aria-current={active ? "page" : undefined}
                      className={`flex w-full items-center gap-3 rounded-[10px] px-2.5 py-[7px] text-left text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                        active ? "bg-white text-black" : "text-white/80 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] [&>svg]:h-4 [&>svg]:w-4 ${
                          active ? "bg-black/[0.07] text-black" : "bg-white/[0.08] text-white/85"
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {!active && badges[item.id]}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );

  return (
    <SettingsNavContext.Provider value={go}>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-black text-white">
        {/* Desktop sidebar */}
        <aside className="hidden w-[264px] shrink-0 border-r border-white/[0.07] bg-[#0c0c0d] lg:block">{sidebar}</aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {drawer && (
            <>
              <motion.div className="fixed inset-0 z-50 bg-black/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
              <motion.aside
                className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-[#0c0c0d] shadow-2xl ring-1 ring-white/10 lg:hidden"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", duration: 0.32, bounce: 0 }}
              >
                {sidebar}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar */}
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 md:px-6">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10 lg:hidden"
              aria-label="Open settings menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="truncate text-[15px] font-semibold text-white/85 lg:hidden">{current.label}</span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActivityOpen(true)}
                className="relative flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={`Activity${unread ? ` (${unread} new)` : ""}`}
              >
                <ListChecks className="h-[18px] w-[18px]" />
                <span className="hidden sm:inline">Activity</span>
                {unread > 0 && (
                  <span className="min-w-[18px] rounded-full bg-white px-1 text-center text-[11px] font-bold leading-[18px] text-black">{unread > 99 ? "99+" : unread}</span>
                )}
              </button>
              <Button size="sm" variant="secondary" onClick={() => router.push("/")} icon={<X />}>
                Done
              </Button>
            </div>
          </header>

          <main id="settings-scroll" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="mx-auto w-full max-w-[1280px] px-4 pb-24 pt-6 md:px-8 md:pt-10">
              {lowStorage.length > 0 && !storageDismissed && section !== "storage" && section !== "server" && (
                <div className="mb-8">
                  <Notice
                    tone="danger"
                    title="Storage is running low"
                    action={
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={() => go("storage")}>
                          Manage Storage
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setStorageDismissed(true)}>
                          Dismiss
                        </Button>
                      </div>
                    }
                  >
                    {lowStorage.map((s: any) => `${s.name || s.path}: ${(s.free / 1024 ** 3).toFixed(1)} GB free`).join(" · ")}. New downloads go to the folder with the most free space.
                  </Notice>
                </div>
              )}
              <motion.div key={sectionKey} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                <Section {...sectionProps} />
              </motion.div>
            </div>
          </main>
        </div>

        <ActivityPanel open={activityOpen} onClose={() => setActivityOpen(false)} />
      </div>
    </SettingsNavContext.Provider>
  );
}

function SectionSkeleton() {
  return (
    <div aria-busy="true" className="animate-pulse space-y-8">
      <div className="h-9 w-56 rounded-lg bg-white/[0.06]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[104px] rounded-2xl bg-white/[0.045]" />
        ))}
      </div>
      <div className="h-56 rounded-2xl bg-white/[0.045]" />
    </div>
  );
}
