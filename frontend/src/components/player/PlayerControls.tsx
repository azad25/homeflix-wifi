"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/** Large, borderless player icon button (Netflix-style). */
export function PlayerIconButton({
  label,
  onClick,
  active = false,
  children,
  buttonRef,
  className = "",
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  buttonRef?: React.Ref<HTMLButtonElement>;
  className?: string;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={`flex h-12 w-12 items-center justify-center rounded-full text-white transition-transform duration-150 hover:scale-[1.18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${className}`}
    >
      {children}
    </button>
  );
}

/** Circular-arrow skip icon with the seconds inside, like Netflix's ±10. */
export function SkipIcon({ direction, seconds = 10 }: { direction: "back" | "forward"; seconds?: number }) {
  const flip = direction === "forward";
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform={flip ? "translate(24 0) scale(-1 1)" : undefined}>
        <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
        <path d="M4.2 3.2v4h4" />
      </g>
      <text x="12" y="15.6" textAnchor="middle" fontSize="7.8" fontWeight={700} fill="currentColor" stroke="none" fontFamily="var(--tv-font)">
        {seconds}
      </text>
    </svg>
  );
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** Playback speed popover (Netflix-style horizontal scale). */
export function SpeedControl({ rate, onChange, icon }: { rate: number; onChange: (r: number) => void; icon: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <PlayerIconButton label={`Playback speed (${rate}x)`} onClick={() => setOpen((o) => !o)} active={open}>
        {icon}
      </PlayerIconButton>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-4 w-[min(560px,90vw)] rounded-2xl bg-[#262626]/95 px-8 pb-7 pt-6 text-white shadow-2xl backdrop-blur-xl"
            role="dialog"
            aria-label="Playback speed"
          >
            <h3 className="mb-6 text-[22px] font-bold">Playback Speed</h3>
            <div className="relative">
              <div className="absolute left-[8%] right-[8%] top-[9px] h-[2px] bg-white/25" />
              <div className="relative grid" style={{ gridTemplateColumns: `repeat(${SPEEDS.length}, 1fr)` }}>
                {SPEEDS.map((s) => {
                  const active = s === rate;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onChange(s)}
                      aria-pressed={active}
                      className="group flex flex-col items-center gap-3 focus-visible:outline-none"
                    >
                      <span
                        className={`rounded-full transition-all ${
                          active ? "h-5 w-5 border-[3px] border-white bg-[#262626] ring-4 ring-white/20" : "mt-[3px] h-3.5 w-3.5 bg-white/60 group-hover:bg-white"
                        }`}
                      />
                      <span className={`text-[15px] ${active ? "font-semibold text-white" : "text-white/60 group-hover:text-white"}`}>
                        {s === 1 ? "1x (Normal)" : `${s}x`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
