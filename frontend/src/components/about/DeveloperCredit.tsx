"use client";

import React from "react";
import { Mail, ExternalLink, Code2, Heart, Coffee } from "lucide-react";

/** Who built HomeFlix — shared by the About page and Settings → About. */
export const CREDITS = {
  developer: "Ferdous Azad",
  role: "Developer of HomeFlix",
  email: "ferdousazad12@gmail.com",
  github: "https://github.com/azad25",
  donate: "https://buymeacoffee.com/ferdousazad",
  repos: [
    { name: "homeflix-wifi", url: "https://github.com/azad25/homeflix-wifi", label: "Server + web app" },
    { name: "homeflix-tv-app", url: "https://github.com/azad25/homeflix-tv-app", label: "Android TV app" },
  ],
} as const;

export default function DeveloperCredit({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-br from-red-950/40 via-black/60 to-black/80 ${compact ? "p-5" : "p-8"}`}>
      <div className="text-xs font-bold tracking-[0.25em] text-white/40 uppercase">Developed by</div>
      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-600 text-lg font-bold text-white shadow-lg shadow-red-900/40">
          FA
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{CREDITS.developer}</div>
          <div className="text-sm text-white/60">{CREDITS.role}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a href={`mailto:${CREDITS.email}`} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-white/80 transition hover:bg-white/10 hover:text-white">
          <Mail className="h-5 w-5 text-red-500" />
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/40">Contact</div>
            <div className="text-sm font-medium">{CREDITS.email}</div>
          </div>
        </a>
        <a href={CREDITS.github} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-white/80 transition hover:bg-white/10 hover:text-white">
          <ExternalLink className="h-5 w-5 text-red-500" />
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/40">GitHub</div>
            <div className="text-sm font-medium">github.com/azad25</div>
          </div>
        </a>
      </div>

      <a
        href={CREDITS.donate}
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#FFDD00] px-5 py-3 text-black transition hover:brightness-95"
      >
        <span className="flex items-center gap-3">
          <Coffee className="h-5 w-5" />
          <span>
            <span className="block text-sm font-bold">Buy me a coffee</span>
            <span className="block text-xs text-black/70">Enjoying HomeFlix? Support its development.</span>
          </span>
        </span>
        <span className="text-xs font-semibold">buymeacoffee.com/ferdousazad</span>
      </a>

      {!compact && (
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
            <Code2 className="h-4 w-4" /> Open source
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {CREDITS.repos.map((r) => (
              <a key={r.name} href={r.url} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 px-4 py-3 transition hover:border-red-500/60 hover:bg-white/5">
                <div className="text-sm font-semibold text-white">{r.name}</div>
                <div className="text-xs text-white/50">{r.label}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 text-xs text-white/40">
        <Heart className="h-3.5 w-3.5 text-red-500" /> © {CREDITS.developer}. Thanks for using and contributing to HomeFlix.
      </div>
    </div>
  );
}
