import React from "react";

/** HomeFlix mark: a roof over a TV, the play button cut out of the screen. */
export function BrandMark({ className = "h-7 w-7", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <path d="M13 26 32 10.5 51 26" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M21 27h22a6 6 0 0 1 6 6v11a6 6 0 0 1-6 6H21a6 6 0 0 1-6-6V33a6 6 0 0 1 6-6Zm7.6 5.4v12.2c0 .9 1 1.5 1.8 1l9.1-6.1c.7-.5.7-1.5 0-2l-9.1-6.1c-.8-.5-1.8.1-1.8 1Z"
      />
      <rect x="24" y="53" width="16" height="4" rx="2" fill="currentColor" />
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
