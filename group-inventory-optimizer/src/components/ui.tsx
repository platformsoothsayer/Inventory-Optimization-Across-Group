"use client";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6 mb-4">
      <div className="min-w-0">
        <h1 className="text-[1.5rem] font-semibold text-ink leading-tight">{title}</h1>
        {subtitle && <div className="text-[0.95rem] text-muted mt-1">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-2">
      <h2 className="text-[1rem] font-semibold text-ink">{children}</h2>
      {sub && <div className="text-[0.82rem] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export function Kpi({ label, value, sub, sub2, accent = false }: { label: string; value: ReactNode; sub?: ReactNode; sub2?: ReactNode; accent?: boolean }) {
  return (
    <div className="px-5 first:pl-0 min-w-0">
      <div className="text-[0.82rem] text-muted leading-snug min-h-[2.2em] [text-wrap:balance]">{label}</div>
      <div className={`kpi-value text-[2.1rem] font-semibold leading-tight mt-1 ${accent ? "text-teal-ink" : "text-ink"}`}>{value}</div>
      {sub && <div className="text-[0.8rem] text-muted mt-0.5 tnum leading-snug">{sub}</div>}
      {sub2 && <div className="text-[0.8rem] mt-0.5 tnum whitespace-nowrap">{sub2}</div>}
    </div>
  );
}

export const AGING_COLORS = ["#e3d8bd", "#e2b064", "#cf7432", "#a33a25"];

export function agingColorForShare(share: number): string {
  // Sequential scale for the share over 90 days, same palette as the buckets.
  const stops = [0, 0.1, 0.2, 0.3];
  let i = 0;
  while (i < stops.length - 1 && share >= stops[i + 1]) i++;
  return AGING_COLORS[i];
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "action" | "approved" | "rejected" | "a3" | "a2" | "a0" }) {
  const cls = {
    neutral: "bg-line-2 text-muted",
    action: "bg-teal-soft text-teal-ink",
    approved: "bg-teal text-white",
    rejected: "bg-line-2 text-faint line-through",
    a3: "bg-[#f6e1dc] text-[#8a2f1e]",
    a2: "bg-[#f8e7d6] text-[#8f4a17]",
    a0: "bg-[#f1ecdf] text-[#6b5a2e]",
  }[tone];
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-[0.8rem] font-medium whitespace-nowrap ${cls}`}>{children}</span>;
}

export function Button({ children, onClick, variant = "primary", small = false, disabled = false }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost"; small?: boolean; disabled?: boolean }) {
  const cls = {
    primary: "bg-teal text-white hover:bg-teal-ink",
    secondary: "border border-line bg-white text-ink hover:border-faint",
    ghost: "text-muted hover:text-ink",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${cls} ${small ? "px-2.5 py-1 text-[0.8rem]" : "px-4 py-1.5 text-[0.9rem]"} rounded font-medium whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
    >
      {children}
    </button>
  );
}
