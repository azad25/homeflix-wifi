"use client";

// Activity log for the settings panel. Sections report progress with log();
// the shell shows the history in a panel and pops a toast for results
// (lines starting with ✅ / ❌ / ⚠️).

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";

export interface ActivityLine {
  id: number;
  time: string;
  text: string;
}

interface ActivityContextValue {
  log: (message: string) => void;
  lines: ActivityLine[];
  unread: number;
  markRead: () => void;
  clear: () => void;
}

const ActivityContext = createContext<ActivityContextValue | null>(null);

type ToastKind = "success" | "error" | "warning";
const toastKind = (t: string): ToastKind | null =>
  t.startsWith("✅") ? "success" : t.startsWith("❌") ? "error" : t.startsWith("⚠️") ? "warning" : null;

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<ActivityLine[]>([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<{ id: number; kind: ToastKind; text: string } | null>(null);
  const idRef = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const log = useCallback((message: string) => {
    const text = String(message);
    const id = ++idRef.current;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLines((prev) => [...prev, { id, time, text }].slice(-300));
    setUnread((n) => n + 1);
    const kind = toastKind(text);
    if (kind) {
      setToast({ id, kind, text: text.replace(/^(✅|❌|⚠️)\s*/, "") });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), kind === "error" ? 6000 : 3500);
    }
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const value = useMemo<ActivityContextValue>(
    () => ({ log, lines, unread, markRead: () => setUnread(0), clear: () => { setLines([]); setUnread(0); } }),
    [log, lines, unread]
  );

  return (
    <ActivityContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex justify-center px-4" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-2xl bg-[#2c2c2e]/95 px-4 py-3 text-[14px] text-white shadow-[0_18px_50px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-xl"
            >
              {toast.kind === "success" ? (
                <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-success" />
              ) : toast.kind === "error" ? (
                <XCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-danger" />
              ) : (
                <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-danger" />
              )}
              <span className="line-clamp-3 min-w-0 flex-1 break-words">{toast.text}</span>
              <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="-mr-1 rounded-full p-0.5 text-white/50 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error("useActivity must be used inside ActivityProvider");
  return ctx;
}

/** Just the log function (stable). */
export function useLog() {
  return useActivity().log;
}

/** Slide-over listing the session's activity. */
export function ActivityPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lines, clear, markRead } = useActivity();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    markRead();
    endRef.current?.scrollIntoView({ block: "end" });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lines.length]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[80] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-label="Activity"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", duration: 0.35, bounce: 0 }}
            className="fixed inset-y-0 right-0 z-[85] flex w-full max-w-md flex-col bg-[#1c1c1e]/95 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
              <div>
                <h2 className="text-[17px] font-semibold text-white">Activity</h2>
                <p className="text-[12px] text-white/45">What the settings panel did this session</p>
              </div>
              <div className="flex items-center gap-1">
                {lines.length > 0 && (
                  <button type="button" onClick={clear} className="rounded-full px-3 py-1.5 text-[13px] font-medium text-white/60 hover:bg-white/10 hover:text-white">
                    Clear
                  </button>
                )}
                <button type="button" onClick={onClose} aria-label="Close activity" className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 font-mono text-[12px] leading-relaxed">
              {lines.length === 0 ? (
                <p className="px-2 py-10 text-center font-sans text-[13px] text-white/40">Nothing yet. Results of scans, updates and edits show up here.</p>
              ) : (
                lines.map((l) => (
                  <div key={l.id} className="flex gap-3 rounded-lg px-2 py-1 hover:bg-white/[0.04]">
                    <span className="shrink-0 text-white/30">{l.time}</span>
                    <span className="min-w-0 whitespace-pre-wrap break-words text-white/80">{l.text}</span>
                  </div>
                ))
              )}
              <div ref={endRef} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
