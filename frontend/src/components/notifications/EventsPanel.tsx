"use client";

import React, { useState } from "react";
import { ArrowUpCircle, CheckCircle2, ChevronRight, Download, HardDrive, MonitorSmartphone, AlertTriangle, Bell, Activity } from "lucide-react";
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

type Tone = "green" | "red" | "yellow" | "blue" | "neutral";

const KIND: Record<string, { icon: React.ReactNode; tone: Tone }> = {
  download_started: { icon: <Download />, tone: "blue" },
  download_completed: { icon: <CheckCircle2 />, tone: "green" },
  download_failed: { icon: <AlertTriangle />, tone: "red" },
  download_space: { icon: <HardDrive />, tone: "yellow" },
  update_available: { icon: <ArrowUpCircle />, tone: "blue" },
  update_installed: { icon: <CheckCircle2 />, tone: "green" },
  tvapp_available: { icon: <MonitorSmartphone />, tone: "blue" },
  tvapp_published: { icon: <MonitorSmartphone />, tone: "neutral" },
  low_storage: { icon: <HardDrive />, tone: "red" },
};

const TONE: Record<Tone, string> = {
  green: "bg-[#30d158]/15 text-[#30d158]",
  red: "bg-[#ff453a]/15 text-[#ff6961]",
  yellow: "bg-[#ffd60a]/15 text-[#ffd60a]",
  blue: "bg-[#0a84ff]/15 text-[#64a8ff]",
  neutral: "bg-white/[0.08] text-white/80",
};

const ago = (ts: number) => {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

/** Server & download activity: a timeline card next to the feed. */
export default function EventsPanel({ events, className = "" }: { events: EventNotification[]; className?: string }) {
  const navigate = useNavigate();
  const [all, setAll] = useState(false);
  const shown = all ? events : events.slice(0, 5);
  return (
    <section aria-label="Activity" className={`overflow-hidden rounded-[20px] bg-white/[0.045] ring-1 ring-inset ring-white/[0.07] ${className}`}>
      <div className="flex items-center gap-2.5 px-5 pb-2 pt-4">
        <Activity className="h-[18px] w-[18px] text-white/60" />
        <h2 className="flex-1 text-[17px] font-semibold tracking-[-0.01em] text-white">Activity</h2>
        {events.length > 0 && <span className="rounded-full bg-white/[0.1] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-white/70">{events.length}</span>}
      </div>
      {events.length === 0 ? (
        <div className="px-5 pb-5 pt-1">
          <p className="text-[13px] leading-relaxed text-white/45">Downloads, updates and storage alerts from your server show up here.</p>
        </div>
      ) : (
        <ol className="relative px-3 pb-2">
          {shown.map((e, i) => {
            const k = KIND[e.event || ""] || { icon: <Bell />, tone: "neutral" as Tone };
            return (
              <li key={e.id} className="relative">
                {i < shown.length - 1 && <span aria-hidden className="absolute bottom-0 left-[29px] top-11 w-px bg-white/[0.08]" />}
                <button
                  type="button"
                  onClick={() => e.link && navigate.push(e.link)}
                  disabled={!e.link}
                  className="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors enabled:hover:bg-white/[0.05]"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full [&>svg]:h-4 [&>svg]:w-4 ${TONE[k.tone]}`}>{k.icon}</span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">{e.title}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-white/35">{ago(e.timestamp)}</span>
                    </span>
                    {e.message && <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-white/55">{e.message}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {events.length > 5 && (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          className="flex w-full items-center justify-center gap-1 border-t border-white/[0.07] py-3 text-[13px] font-semibold text-white/70 transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          {all ? "Show less" : `Show all ${events.length}`} <ChevronRight className={`h-4 w-4 transition-transform ${all ? "-rotate-90" : "rotate-90"}`} />
        </button>
      )}
    </section>
  );
}
