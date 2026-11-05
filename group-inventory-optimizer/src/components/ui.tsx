"use client";
import type { ReactNode } from "react";
import { agingRamp, brandColor, palette } from "@/theme/tokens";

export const AGING_COLORS = agingRamp;

export function agingColorForShare(share: number): string {
  // Sequential scale for the share over 90 days, same ramp as the buckets.
  const stops = [0, 0.1, 0.2, 0.3];
  let i = 0;
  while (i < stops.length - 1 && share >= stops[i + 1]) i++;
  return agingRamp[i];
}

export function Panel({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <div className={`panel anim-rise ${className}`} style={delay ? { animationDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6 mb-3">
      <div className="min-w-0">
        <h1 className="text-[1.5rem] font-semibold text-navy leading-tight tracking-[-0.01em]">{title}</h1>
        {subtitle && <div className="text-[0.95rem] text-muted mt-1">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

export function SectionTitle({ children, sub, right }: { children: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[1rem] font-semibold text-navy">{children}</h2>
        {sub && <div className="text-[0.82rem] text-muted mt-0.5">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Sparkline({ data, base, color = palette.deepTeal, height = 30 }: { data: number[]; base?: number[]; color?: string; height?: number }) {
  const all = [...data, ...(base ?? [])];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const W = 100;
  const pts = (d: number[]) => d.map((v, i) => `${((i / (d.length - 1)) * W).toFixed(2)},${(2 + (1 - (v - lo) / span) * (height - 4)).toFixed(2)}`).join(" ");
  const area = `0,${height} ${pts(data)} ${W},${height}`;
  const id = `sg${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full anim-fade" style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {base && <polyline points={pts(base)} fill="none" stroke={palette.secondary} strokeOpacity={0.45} strokeWidth={1.2} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={pts(data)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Delta chip: arrow plus signed percent. Color says good or bad, the arrow and sign say direction. */
export function DeltaChip({ value, goodWhen, format }: { value: number; goodWhen: "up" | "down"; format: (x: number) => string }) {
  const up = value > 0;
  const flat = Math.abs(value) < 0.0005;
  const good = flat ? null : (up && goodWhen === "up") || (!up && goodWhen === "down");
  const cls = good === null ? "bg-line-2 text-navy" : good ? "bg-green-soft text-navy" : "bg-coral-soft text-navy";
  const arrowColor = good === null ? palette.secondary : good ? palette.green : palette.coral;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[1px] text-[0.78rem] font-semibold tnum whitespace-nowrap ${cls}`}>
      <span style={{ color: arrowColor }} aria-hidden>
        {flat ? "■" : up ? "▲" : "▼"}
      </span>
      {format(value)}
    </span>
  );
}

export function Kpi({
  label,
  value,
  sub,
  sub2,
  accent,
  spark,
  sparkBase,
  sparkColor,
  delta,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  sub2?: ReactNode;
  accent?: "action" | "gain";
  spark?: number[];
  sparkBase?: number[];
  sparkColor?: string;
  delta?: ReactNode;
}) {
  const valueColor = accent === "gain" ? "text-green" : accent === "action" ? "text-deep-teal" : "text-navy";
  return (
    <div className="px-4 min-w-0 flex flex-col">
      <div className="text-[0.8rem] text-muted leading-snug min-h-[2.5em] [text-wrap:balance]">{label}</div>
      <div className={`kpi-value text-[1.9rem] font-semibold leading-tight mt-0.5 whitespace-nowrap ${valueColor}`}>{value}</div>
      {(spark || delta) && (
        <div className="flex items-center gap-2 mt-0.5">
          {delta}
          {spark && (
            <div className="flex-1 min-w-[2.5rem]">
              <Sparkline data={spark} base={sparkBase} color={sparkColor} height={24} />
            </div>
          )}
        </div>
      )}
      {sub && <div className="text-[0.78rem] text-muted mt-1 tnum leading-snug">{sub}</div>}
      {sub2 && <div className="text-[0.78rem] mt-0.5 tnum whitespace-nowrap">{sub2}</div>}
    </div>
  );
}

export function BrandDot({ brand, size = 9 }: { brand: string; size?: number }) {
  return <span className="inline-block rounded-full shrink-0" style={{ width: size, height: size, background: brandColor[brand] ?? palette.secondary }} aria-hidden />;
}

type Tone = "neutral" | "action" | "approved" | "rejected" | "proposed" | "risk" | "a0" | "a1" | "a2" | "a3" | "gain";
export function Badge({ children, tone = "neutral", icon }: { children: ReactNode; tone?: Tone; icon?: ReactNode }) {
  const cls: Record<Tone, string> = {
    neutral: "bg-line-2 text-navy",
    action: "bg-teal-soft text-deep-teal",
    approved: "bg-deep-teal text-white",
    rejected: "bg-line-2 text-muted line-through",
    proposed: "bg-amber-soft text-navy",
    risk: "bg-coral-soft text-navy",
    gain: "bg-green-soft text-navy",
    a0: "text-navy",
    a1: "text-navy",
    a2: "text-navy",
    a3: "text-navy",
  };
  const agingIdx = tone.startsWith("a") && tone.length === 2 ? Number(tone[1]) : -1;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[2px] text-[0.78rem] font-medium whitespace-nowrap ${cls[tone]}`}
      style={agingIdx >= 0 ? { background: agingRamp[agingIdx] } : undefined}
    >
      {icon}
      {children}
    </span>
  );
}

export function Button({ children, onClick, variant = "primary", small = false, disabled = false }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost"; small?: boolean; disabled?: boolean }) {
  const cls = {
    primary: "bg-deep-teal text-white hover:brightness-110 shadow-[0_1px_2px_rgb(11_31_58/0.15)]",
    secondary: "bg-surface text-navy ring-1 ring-line hover:ring-deep-teal hover:text-deep-teal",
    ghost: "text-muted hover:text-navy",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${cls} ${small ? "px-2.5 py-1 text-[0.8rem]" : "px-4 py-1.5 text-[0.9rem]"} rounded-md font-medium whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed transition`}
    >
      {children}
    </button>
  );
}
