"use client";

import React, { useState } from "react";
import { Film } from "lucide-react";

interface TVArtworkCardProps {
  title: string;
  image?: string | null;
  /** Optional title-treatment logo drawn over landscape artwork. */
  logo?: string | null;
  /** Line under the title, e.g. "2024 · Drama". */
  caption?: React.ReactNode;
  /** Small badge in the top-left corner, e.g. provider or "New". */
  badge?: React.ReactNode;
  /** Bottom progress (0..1) for continue-watching items. */
  progress?: number;
  variant?: "landscape" | "poster";
  onSelect?: () => void;
  href?: string;
  className?: string;
  priority?: boolean;
  /** Extra overlay controls (render only buttons, not links). */
  overlay?: React.ReactNode;
}

/**
 * Apple TV artwork tile. Landscape (16:9) is the default "Up Next" look;
 * poster (2:3) for library grids. The title sits under the artwork, the
 * artwork lifts with a sheen on hover/focus (.tv-card), and it's a real
 * button/link so remotes and keyboards can focus it.
 */
export default function TVArtworkCard({
  title,
  image,
  logo,
  caption,
  badge,
  progress,
  variant = "landscape",
  onSelect,
  href,
  className = "",
  priority = false,
  overlay,
}: TVArtworkCardProps) {
  const [failed, setFailed] = useState(false);
  const width = variant === "landscape" ? "w-[78vw] max-w-[320px] sm:w-[300px] lg:w-[340px]" : "w-[40vw] max-w-[190px] sm:w-[170px] lg:w-[190px]";
  const aspect = variant === "landscape" ? "aspect-video" : "aspect-[2/3]";

  const art = (
    <div className={`tv-card ${aspect} w-full`}>
      {image && !failed ? (
        <img
          src={image}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-800 to-zinc-900 p-3 text-center">
          <Film className="h-7 w-7 text-white/30" />
          <span className="line-clamp-2 text-sm font-semibold text-white/70">{title}</span>
        </div>
      )}
      {variant === "landscape" && logo && !failed && image && (
        <>
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
          <img
            src={logo}
            alt=""
            loading="lazy"
            className="absolute bottom-3 left-3 max-h-[28%] max-w-[55%] object-contain object-left drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
          />
        </>
      )}
      {badge && <div className="absolute left-2.5 top-2.5">{badge}</div>}
      {typeof progress === "number" && progress > 0 && (
        <div className="absolute inset-x-3 bottom-2.5 h-1 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
      )}
      {overlay}
    </div>
  );

  const label = (
    <div className="mt-3 min-w-0 px-0.5">
      <p className="truncate text-[15px] font-semibold leading-tight text-[var(--tv-text)]">{title}</p>
      {caption && <p className="tv-caption mt-1 truncate">{caption}</p>}
    </div>
  );

  const common = `tv-card-group block text-left outline-none ${width} ${className}`;

  if (href) {
    return (
      <a href={href} className={common} aria-label={title} onClick={onSelect}>
        {art}
        {label}
      </a>
    );
  }
  return (
    <button type="button" className={common} aria-label={title} onClick={onSelect}>
      {art}
      {label}
    </button>
  );
}
