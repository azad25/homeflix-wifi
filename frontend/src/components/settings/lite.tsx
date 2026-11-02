"use client";

// Drop-in, lightweight stand-ins for the scrollx GlassCard / MagneticButton /
// ScrollReveal used by the older settings panels: same props, settings look,
// no per-mousemove state or scroll observers.

import React from "react";

export function GlassCard({ className = "", children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean; glow?: boolean }) {
  const { hover: _h, glow: _g, ...props } = rest as any;
  return (
    <div className={`rounded-2xl bg-white/[0.045] ring-1 ring-inset ring-white/[0.07] ${className}`} {...props}>
      {children}
    </div>
  );
}

export function MagneticButton({
  className = "",
  children,
  strength: _strength,
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { strength?: number }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-[background-color,opacity,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ScrollReveal({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; [k: string]: any }) {
  return className || style ? (
    <div className={className} style={style}>
      {children}
    </div>
  ) : (
    <>{children}</>
  );
}
