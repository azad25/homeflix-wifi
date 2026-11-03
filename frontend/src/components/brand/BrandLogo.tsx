import React from "react";

/** HomeFlix mark: a rounded play button. */
export function BrandMark({ className = "h-7 w-7", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <path fill="currentColor" d="M24 17.6v28.8c0 2.4 2.6 3.9 4.7 2.7l24-14.4c2-1.2 2-4.1 0-5.3l-24-14.4c-2.1-1.3-4.7.2-4.7 2.6Z" />
    </svg>
  );
}

/** Mark + wordmark, black & white. */
export default function BrandLogo({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const s = { sm: ["h-6 w-6", "text-[18px]"], md: ["h-[30px] w-[30px]", "text-[22px]"], lg: ["h-10 w-10", "text-[30px]"] }[size];
  return (
    <span className={`inline-flex items-center gap-2 text-white ${className}`}>
      <BrandMark className={`${s[0]} shrink-0`} />
      <span className={`${s[1]} leading-none tracking-[-0.04em]`}>
        <span className="font-extrabold">Home</span>
        <span className="font-light text-white/80">Flix</span>
      </span>
    </span>
  );
}
