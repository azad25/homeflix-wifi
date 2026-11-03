"use client";

// Settings UI kit: Apple TV / macOS System Settings style building blocks
// shared by every settings section (neutral glass, white primary actions,
// colour only for status).

import React from "react";
import { Loader2 } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Page heading for a settings section. */
export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-[var(--tv-text)] md:text-[34px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-[var(--tv-text-secondary)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Grouped inset list/card with an optional small heading and footer note. */
export function Group({
  title,
  description,
  actions,
  footer,
  children,
  className,
  padded = false,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Pad the body (free-form content) instead of rendering edge-to-edge rows. */
  padded?: boolean;
}) {
  return (
    <section className={cx("min-w-0", className)}>
      {(title || actions) && (
        <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            {title && <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--tv-text)]">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-[var(--tv-text-secondary)]">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div
        className={cx(
          "overflow-hidden rounded-2xl bg-white/[0.045] ring-1 ring-inset ring-white/[0.07]",
          padded ? "p-5 md:p-6" : "divide-y divide-white/[0.07]"
        )}
      >
        {children}
      </div>
      {footer && <p className="mt-2 px-1 text-[12px] leading-relaxed text-[var(--tv-text-tertiary)]">{footer}</p>}
    </section>
  );
}

/** One row of a Group: icon, title/description, trailing control. */
export function Row({
  icon,
  title,
  description,
  children,
  onClick,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      {icon && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white/[0.08] text-white/80 [&>svg]:h-[18px] [&>svg]:w-[18px]">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-[var(--tv-text)]">{title}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-[var(--tv-text-secondary)]">{description}</span>}
      </span>
      {children && <span className="flex shrink-0 items-center gap-2">{children}</span>}
    </>
  );
  const base = "flex w-full items-center gap-3.5 px-4 py-3.5 text-left md:px-5";
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(base, "transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.07] focus-visible:outline-none", className)}>
      {body}
    </button>
  ) : (
    <div className={cx(base, className)}>{body}</div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-[#f5f5f7] text-black hover:bg-white",
    secondary: "bg-white/[0.12] text-white hover:bg-white/[0.2]",
    ghost: "text-white/75 hover:bg-white/[0.08] hover:text-white",
    danger: "bg-danger/[0.14] text-danger hover:bg-danger/[0.24]",
  };
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,transform,opacity] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
        size === "sm" ? "h-8 px-3.5 text-[13px] [&>svg]:h-3.5 [&>svg]:w-3.5" : "h-10 px-5 text-[14px] [&>svg]:h-4 [&>svg]:w-4",
        variants[variant],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

/** iOS-style switch. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:opacity-45",
        checked ? "bg-success" : "bg-white/[0.16]"
      )}
    >
      <span
        className={cx(
          "inline-block h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.3)] transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        )}
      />
    </button>
  );
}

type Tone = "neutral" | "success" | "warning" | "danger" | "info";
const toneText: Record<Tone, string> = {
  neutral: "bg-white/[0.1] text-white/75",
  success: "bg-success/[0.15] text-success",
  warning: "bg-danger/[0.14] text-danger",
  danger: "bg-danger/[0.15] text-danger",
  info: "bg-info/[0.16] text-info",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold", toneText[tone], className)}>
      {children}
    </span>
  );
}

/** Coloured status dot. */
export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  const c: Record<Tone, string> = {
    neutral: "bg-white/40",
    success: "bg-success",
    warning: "bg-danger",
    danger: "bg-danger",
    info: "bg-info",
  };
  return <span className={cx("inline-block h-2 w-2 shrink-0 rounded-full", c[tone])} />;
}

/** Big number tile for overviews. */
export function Stat({
  label,
  value,
  sub,
  icon,
  onClick,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between text-[13px] font-medium text-[var(--tv-text-secondary)]">
        <span>{label}</span>
        {icon && <span className="text-white/45 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      </div>
      <div className="mt-2 truncate text-[28px] font-bold leading-none tracking-[-0.02em] text-[var(--tv-text)] tabular-nums">{value}</div>
      {sub && <div className="mt-2 truncate text-[12px] text-[var(--tv-text-tertiary)]">{sub}</div>}
    </>
  );
  const base = "min-w-0 rounded-2xl bg-white/[0.045] p-4 text-left ring-1 ring-inset ring-white/[0.07] md:p-5";
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(base, "transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-white/60")}>
      {inner}
    </button>
  ) : (
    <div className={base}>{inner}</div>
  );
}

/** Grid of flat tiles inside a Group, separated by hairlines. */
export function TileGrid({ cols = 2, children }: { cols?: 2 | 3; children: React.ReactNode }) {
  return (
    <div className={cx("grid gap-px bg-white/[0.07]", cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
      {React.Children.map(children, (c) => (c ? <div className="min-w-0 bg-[#0b0b0b]">{c}</div> : null))}
    </div>
  );
}

/** Clickable action card (maintenance tasks, quick actions). */
export function ActionTile({
  icon,
  title,
  description,
  onClick,
  loading,
  disabled,
  danger,
  flat,
}: {
  flat?: boolean;
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        "group flex h-full w-full min-w-0 items-start gap-3.5 p-4 text-left transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:p-5",
        flat
          ? "hover:bg-white/[0.05] focus-visible:bg-white/[0.07]"
          : "rounded-2xl bg-white/[0.045] ring-1 ring-inset ring-white/[0.07] hover:bg-white/[0.075] focus-visible:ring-white/60"
      )}
    >
      <span
        className={cx(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5",
          danger ? "bg-danger/[0.14] text-danger" : "bg-white/[0.09] text-white/85"
        )}
      >
        {loading ? <Loader2 className="animate-spin" /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-[var(--tv-text)]">{title}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-[var(--tv-text-secondary)]">{description}</span>}
      </span>
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-white/30 [&>svg]:h-10 [&>svg]:w-10">{icon}</div>}
      <p className="text-[15px] font-semibold text-white/80">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-[var(--tv-text-secondary)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", title, children, action }: { tone?: Tone; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode }) {
  const ring: Record<Tone, string> = {
    neutral: "bg-white/[0.05] ring-white/10",
    success: "bg-success/[0.08] ring-success/25",
    warning: "bg-danger/[0.07] ring-danger/25",
    danger: "bg-danger/[0.08] ring-danger/25",
    info: "bg-info/[0.08] ring-info/25",
  };
  return (
    <div className={cx("flex flex-col gap-3 rounded-2xl p-4 ring-1 ring-inset sm:flex-row sm:items-center", ring[tone])}>
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-white/75">
        {title && <p className="mb-0.5 text-[14px] font-semibold text-white">{title}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Shared input / select styling. */
export const inputClass =
  "h-10 w-full rounded-xl bg-white/[0.07] px-3.5 text-[14px] text-white placeholder:text-white/35 ring-1 ring-inset ring-white/[0.08] transition focus:bg-white/[0.1] focus:outline-none focus:ring-white/40";

export function Field({ label, hint, children }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[13px] font-medium text-white/70">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-white/40">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-white/[0.08] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
            o.value === value ? "bg-white text-black" : "text-white/70 hover:text-white"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
