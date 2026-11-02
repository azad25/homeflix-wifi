"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Poster strip under a full-screen hero: shows where you are and jumps to a
 * slide. The active poster gets a white ring (no scaling, so it never covers
 * its neighbours) and is kept in view.
 */
export default function HeroThumbStrip({
  items,
  active,
  onSelect,
  poster,
}: {
  items: { id: number | string; title: string }[];
  active: number;
  onSelect: (index: number) => void;
  poster: (index: number) => string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const row = rowRef.current;
    const el = row?.querySelector<HTMLElement>(`[data-i="${active}"]`);
    if (!row || !el) return;
    // Scroll only the strip (scrollIntoView would also scroll the page).
    const left = el.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + el.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(0, left - row.clientWidth / 2 + el.offsetWidth / 2), behavior: "smooth" });
    }
  }, [active]);

  if (items.length < 2) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 md:bottom-8">
      <div
        ref={rowRef}
        role="tablist"
        aria-label="Featured titles"
        className="tv-gutter pointer-events-auto flex gap-2.5 overflow-x-auto py-2 [scrollbar-width:none] md:gap-3 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((it, i) => {
          const on = i === active;
          const key = String(it.id);
          return (
            <button
              key={key}
              data-i={i}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={it.title}
              title={it.title}
              onClick={() => onSelect(i)}
              className={`tv-focus relative h-[84px] w-[56px] shrink-0 overflow-hidden rounded-[9px] bg-white/[0.08] transition-[opacity,box-shadow] duration-300 md:h-[120px] md:w-[80px] ${
                on ? "opacity-100 ring-2 ring-white shadow-[0_12px_28px_-8px_rgba(0,0,0,0.9)]" : "opacity-50 hover:opacity-90"
              }`}
            >
              {!broken[key] && poster(i) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={poster(i)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={() => setBroken((b) => ({ ...b, [key]: true }))}
                />
              )}
              {on && <span className="absolute inset-x-0 bottom-0 h-1 bg-white" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
