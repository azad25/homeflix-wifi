"use client";

import React, { useState } from "react";
import { ArrowUpCircle, CheckCircle2, ChevronDown, Download, HardDrive, MonitorSmartphone, AlertTriangle, Bell } from "lucide-react";
import { useNavigate } from "@/hooks/useNavigate";

export interface EventNotification {
  id: string;
  type: string;
  event?: string;
  title: string;
  message: string;
  link?: string;
  timestamp: number;
}

export const isEventNotification = (n: { type: string }) => n.type === "auto_download" || n.type === "system";

const ICON: Record<string, React.ReactNode> = {
  download_started: <Download className="h-4 w-4" />,
  download_completed: <CheckCircle2 className="h-4 w-4 text-[#30d158]" />,
  download_failed: <AlertTriangle className="h-4 w-4 text-[#ff453a]" />,
  download_space: <HardDrive className="h-4 w-4 text-[#ffd60a]" />,
  update_available: <ArrowUpCircle className="h-4 w-4 text-[#0a84ff]" />,
  update_installed: <CheckCircle2 className="h-4 w-4 text-[#30d158]" />,
  tvapp_available: <MonitorSmartphone className="h-4 w-4 text-[#0a84ff]" />,
  tvapp_published: <MonitorSmartphone className="h-4 w-4" />,
  low_storage: <HardDrive className="h-4 w-4 text-[#ff453a]" />,
};

const ago = (ts: number) => {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

/** Server & download events, shown above the artwork mosaic. */
export default function EventsPanel({ events }: { events: EventNotification[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  if (!events.length) return null;
  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-40 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-2xl bg-[#1c1c1e]/90 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-2xl">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <Bell className="h-4 w-4 text-white/70" />
        <span className="flex-1 text-[14px] font-semibold text-white">Updates & Downloads</span>
        <span className="rounded-full bg-white/15 px-2 text-[12px] font-bold text-white">{events.length}</span>
        <ChevronDown className={`h-4 w-4 text-white/60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="max-h-[50vh] divide-y divide-white/[0.07] overflow-y-auto border-t border-white/[0.07]">
          {events.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => e.link && navigate.push(e.link)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.05]"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-white/85">
                {ICON[e.event || ""] || <Bell className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-white">{e.title}</span>
                {e.message && <span className="mt-0.5 block text-[12px] leading-snug text-white/55">{e.message}</span>}
              </span>
              <span className="shrink-0 text-[11px] text-white/35">{ago(e.timestamp)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
