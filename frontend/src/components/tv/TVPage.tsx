"use client";

import React from "react";

/** Large Apple TV page title with optional subtitle and trailing actions. */
export function TVPageHeader({
  title,
  subtitle,
  actions,
  className = "",
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-[var(--tv-text)] md:text-5xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-[var(--tv-text-secondary)] md:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export interface TVSegment<T extends string> {
  key: T;
  label: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
}

/** Apple-style segmented control (glass pill, white selected segment). */
export function TVSegmented<T extends string>({
  segments,
  value,
  onChange,
  className = "",
  ariaLabel,
}: {
  segments: TVSegment<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`tv-glass inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full p-1 [scrollbar-width:none] ${className}`}
    >
      {segments.map((s) => {
        const active = s.key === value;
        return (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.key)}
            className={`tv-focus flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors duration-200 ${
              active ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {s.icon}
            {s.label}
            {s.badge !== undefined && s.badge !== null && s.badge !== false && (
              <span
                className={`min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-bold leading-5 ${
                  active ? "bg-black/10 text-black" : "bg-white/15 text-white"
                }`}
              >
                {s.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Page shell: top padding below the fixed navbar + Apple TV gutters. */
export function TVPageShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`tv-gutter pb-24 pt-24 md:pt-28 ${className}`}>{children}</div>;
}

/** Skeleton grid while a page loads (instead of a full-screen spinner). */
export function TVGridSkeleton({ count = 12, variant = "poster" }: { count?: number; variant?: "poster" | "landscape" }) {
  return (
    <div
      className={`grid gap-x-5 gap-y-8 ${
        variant === "poster"
          ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      }`}
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className={`animate-pulse rounded-[14px] bg-white/[0.06] ${variant === "poster" ? "aspect-[2/3]" : "aspect-video"}`} />
          <div className="mt-3 h-3.5 w-3/4 animate-pulse rounded bg-white/[0.06]" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-white/[0.04]" />
        </div>
      ))}
    </div>
  );
}
