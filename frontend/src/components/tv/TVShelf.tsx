"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TVShelfProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Optional trailing header content, e.g. a "See All" link. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Apple TV style shelf: a header and a horizontally snapping row. Cards
 * inside lift on hover/focus (see .tv-card), so the row keeps vertical
 * padding for the lift + shadow to render without clipping.
 */
export default function TVShelf({ title, subtitle, action, children, className = "" }: TVShelfProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, children]);

  const scrollBy = (dir: 1 | -1) => {
    const el = rowRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className={`group/shelf relative ${className}`}>
      {(title || action) && (
        <div className="tv-gutter flex items-end justify-between gap-4">
          <div className="min-w-0">
            {title && <h2 className="tv-shelf-title truncate">{title}</h2>}
            {subtitle && <p className="tv-caption mt-0.5 truncate">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="relative">
        <div ref={rowRef} onScroll={update} className="tv-shelf">
          {children}
        </div>
        {canLeft && (
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollBy(-1)}
            className="tv-glass absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white opacity-0 transition-opacity duration-200 group-hover/shelf:opacity-100 focus-visible:opacity-100 md:flex"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {canRight && (
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollBy(1)}
            className="tv-glass absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white opacity-0 transition-opacity duration-200 group-hover/shelf:opacity-100 focus-visible:opacity-100 md:flex"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </section>
  );
}
