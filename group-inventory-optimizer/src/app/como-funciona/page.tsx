"use client";
import { useState } from "react";
import { CartesianGrid, ComposedChart, ErrorBar, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis, ReferenceArea } from "recharts";
import { useApp } from "@/state/AppState";
import { BrandDot, Panel, SectionTitle } from "@/components/ui";
import { brandColor, palette, tint } from "@/theme/tokens";

const STEPS = [1, 2, 3, 4, 5] as const;
const STEP_COLORS = [palette.navy, palette.royal, palette.indigo, palette.amber, palette.teal];

export default function HowItWorks() {
  const { t, present } = useApp();
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const showAll = present;
  return (
    <div className="flex-1 min-h-0 flex flex-col px-8 pt-4 pb-3 overflow-y-auto">
      <div className="flex items-baseline gap-4 mb-2.5">
        <h1 className="text-[1.5rem] font-semibold text-navy leading-tight tracking-[-0.01em]">{t("how.title")}</h1>
        <span className="text-[0.95rem] text-muted">{t("how.subtitle")}</span>
      </div>
      <div className="grid grid-cols-5 gap-3 mb-3">
        {STEPS.map((n, i) => {
          const isOpen = showAll || open[n];
          const c = STEP_COLORS[i];
          return (
            <Panel key={n} className="relative px-3.5 pt-3 pb-2.5 overflow-visible" delay={i * 60}>
              <div className="absolute left-0 top-0 right-0 h-[3px] rounded-t-[10px]" style={{ background: c }} />
              {i < STEPS.length - 1 && (
                <span className="absolute -right-[0.72rem] top-[1.15rem] z-[2] w-[1.1rem] h-[1.1rem] rounded-full bg-surface flex items-center justify-center text-[0.6rem] shadow-sm" style={{ color: palette.deepTeal }} aria-hidden>
                  ▶
                </span>
              )}
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="w-7 h-7 rounded-full text-[0.85rem] font-semibold flex items-center justify-center tnum shrink-0" style={{ background: tint(c, 0.16), color: palette.navy, boxShadow: `inset 0 0 0 1.5px ${c}` }}>
                  {n}
                </span>
                <div className="text-[0.98rem] font-semibold text-navy leading-snug">{t(`how.step${n}`)}</div>
              </div>
              <div className="text-[0.84rem] text-muted leading-snug min-h-[2.5em]">{t(`how.step${n}Desc`)}</div>
              <button className="mt-1 text-[0.76rem] font-semibold text-deep-teal hover:underline uppercase tracking-[0.04em]" onClick={() => setOpen((o) => ({ ...o, [n]: !o[n] }))} disabled={showAll}>
                {t("how.tech")} {showAll ? "" : isOpen ? "▾" : "▸"}
              </button>
              {isOpen && <div className="mt-1 text-[0.74rem] leading-[1.38] text-navy bg-bg rounded-md px-2.5 py-1.5">{t(`how.tech${n}`)}</div>}
            </Panel>
          );
        })}
      </div>
      <div className="grid grid-cols-[1.25fr_1fr_0.6fr] gap-4 flex-1 min-h-0">
        <Backtest />
        <Pooling />
        <Needs />
      </div>
    </div>
  );
}

function EndLabel({ x, y, text, color, bold }: { x: number; y: number; text: string; color: string; bold?: boolean }) {
  return (
    <text x={x + 6} y={y + 4} fontSize={12} fontWeight={bold ? 700 : 500} fill={color}>
      {text}
    </text>
  );
}

function Backtest() {
  const { t, f, backtest, brandName, present } = useApp();
  const fit = backtest.fitMonths;
  const data = backtest.series.slice(fit - 9).map((p) => ({ label: f.monthShort(p.cal, p.year), actual: p.actual, model: p.model, naive: p.naive, test: p.idx >= fit }));
  const firstTest = data.find((d) => d.test)?.label;
  const lastLabel = data[data.length - 1].label;
  const vals = data.flatMap((d) => [d.actual, d.model ?? d.actual, d.naive ?? d.actual]);
  const lo = Math.floor(Math.min(...vals) / 100) * 100;
  const hi = Math.ceil(Math.max(...vals) / 100) * 100;
  const yDomain: [number, number] = [lo, hi];
  const yTicks = Array.from({ length: Math.round((hi - lo) / 100) + 1 }, (_, i) => lo + i * 100).filter((_, i, a) => a.length <= 6 || i % 2 === 0);
  // Direct end labels, nudged apart.
  const end = data[data.length - 1];
  const PLOT_H = 120;
  const pxPerUnit = PLOT_H / (hi - lo);
  const ends = [
    { k: "actual", v: end.actual },
    { k: "model", v: end.model ?? end.actual },
    { k: "naive", v: end.naive ?? end.actual },
  ].sort((a, b) => b.v - a.v);
  const shift: Record<string, number> = {};
  let prevY = -Infinity;
  for (const e of ends) {
    const y0 = (hi - e.v) * pxPerUnit;
    const y = Math.max(y0, prevY + 14);
    shift[e.k] = y - y0;
    prevY = y;
  }
  const lastIdx = data.length - 1;
  const lbl = (k: "actual" | "model" | "naive", text: string, color: string, bold?: boolean) =>
    function L(p: { index?: number; x?: number | string; y?: number | string }) {
      if (p.index !== lastIdx) return <g />;
      return <EndLabel x={Number(p.x)} y={Number(p.y) + shift[k]} text={text} color={color} bold={bold} />;
    };
  const anim = !present;
  return (
    <Panel className="min-w-0 flex flex-col px-4 py-3" delay={120}>
      <SectionTitle sub={t("how.backtestSub")}>{t("how.backtestTitle")}</SectionTitle>
      <div className="flex gap-6 items-end">
        <div>
          <div className="text-[0.78rem] text-muted whitespace-nowrap">{t("how.wapeModel")}</div>
          <div className="kpi-value text-[1.65rem] font-semibold text-deep-teal leading-tight">{f.pct1(backtest.wape.model)}</div>
        </div>
        <div>
          <div className="text-[0.78rem] text-muted whitespace-nowrap">{t("how.wapeNaive")}</div>
          <div className="kpi-value text-[1.65rem] font-semibold text-muted leading-tight">{f.pct1(backtest.wape.naive)}</div>
        </div>
        <div className="text-[0.74rem] text-muted pb-1.5 leading-snug">{t("how.naiveNote")}</div>
      </div>
      <div className="grid grid-cols-[1fr_9rem] gap-4 mt-1">
        <div className="min-w-0">
          <div className="text-[0.85rem] font-medium text-navy">{t("how.groupSales")}</div>
          <div className="h-[9.6rem]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 74, bottom: 0, left: -6 }}>
                <CartesianGrid stroke={palette.divider} strokeDasharray="2 4" vertical={false} />
                {firstTest && <ReferenceArea x1={firstTest} x2={lastLabel} fill={tint(palette.teal, 0.12)} fillOpacity={1} />}
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: palette.secondary }} tickLine={false} axisLine={{ stroke: palette.divider }} interval={1} />
                <YAxis tick={{ fontSize: 12, fill: palette.secondary }} tickLine={false} axisLine={false} width={44} domain={yDomain} ticks={yTicks} tickFormatter={(v: number) => f.int(v)} />
                <Line dataKey="naive" stroke={palette.secondary} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={anim} label={lbl("naive", t("how.naiveShort"), palette.secondary)} />
                <Line dataKey="actual" stroke={palette.navy} strokeWidth={2.2} dot={{ r: 2.5, fill: palette.navy }} isAnimationActive={anim} label={lbl("actual", t("series.actual"), palette.navy)} />
                <Line dataKey="model" stroke={palette.teal} strokeWidth={2.8} dot={{ r: 3, fill: palette.teal }} connectNulls isAnimationActive={anim} label={lbl("model", t("series.model"), palette.deepTeal, true)} />
                <Tooltip formatter={(v: unknown) => f.int(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${palette.divider}` }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <div className="text-[0.85rem] font-medium text-navy">{t("how.byBrand")}</div>
          <table className="w-full text-[0.8rem] tnum">
            <thead>
              <tr className="text-[0.72rem] text-muted">
                <th />
                <th className="text-right font-normal">{t("series.model")}</th>
                <th className="text-right font-normal pl-2">{t("how.naiveShort")}</th>
              </tr>
            </thead>
            <tbody>
              {backtest.byBrand.map((b) => (
                <tr key={b.brand} className="border-t border-line">
                  <td className="py-[3px] text-navy">
                    <span className="inline-flex items-center gap-1.5">
                      <BrandDot brand={b.brand} size={8} />
                      {brandName(b.brand)}
                    </span>
                  </td>
                  <td className={`py-[3px] text-right font-semibold ${b.model <= b.naive ? "text-deep-teal" : "text-navy"}`}>{f.pct(b.model)}</td>
                  <td className="py-[3px] pl-2 text-right text-muted">{f.pct(b.naive)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}

function Pooling() {
  const { t, f, backtest, storeName, modelName, units, brandName } = useApp();
  const story = units.find((u) => u.storyId === 3);
  const modelId = story?.model ?? "Z7";
  const storyStore = story?.store ?? "COY";
  const brandId = story?.brand ?? "ZHE";
  const bc = brandColor[brandId];
  const rows = backtest.pooling[modelId] ?? [];
  const row = rows.find((r) => r.store === storyStore);
  const data = rows.map((r) => ({
    store: storeName(r.store),
    raw: r.raw,
    pooled: r.pooled,
    err: [r.pooled - r.lo, r.hi - r.pooled],
    actual: r.actual,
    focus: r.store === storyStore,
  }));
  const errs = backtest.poolingError;
  const avg = (k: "raw" | "pooled") => errs.reduce((a, e) => a + e[k], 0) / errs.length;
  const brand = story ? brandName(story.brand) : "";
  return (
    <Panel className="min-w-0 flex flex-col px-4 py-3" delay={180}>
      <SectionTitle sub={row ? t(row.months === 1 ? "how.poolingSubOne" : "how.poolingSubMany", { model: `${brand} ${modelName(modelId)}`, store: storeName(storyStore), months: row.months }) : undefined}>
        {t("how.poolingTitle")}
      </SectionTitle>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.75rem] text-muted mb-1">
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full border-2 bg-surface" style={{ borderColor: palette.secondary }} />{t("how.raw")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: bc }} />{t("how.pooled")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-[3px] h-3 bg-navy" />{t("how.actual")}</span>
      </div>
      <div className="h-[10rem]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} layout="vertical" margin={{ top: 10, right: 16, bottom: 14, left: 0 }}>
            <CartesianGrid stroke={palette.divider} strokeDasharray="2 4" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: palette.secondary }} tickLine={false} axisLine={{ stroke: palette.divider }} domain={[0, "dataMax + 3"]} tickFormatter={(v: number) => f.int(v)} label={{ value: t("how.poolingUnit"), position: "insideBottomRight", offset: -8, fontSize: 12, fill: palette.secondary }} />
            <YAxis
              type="category"
              dataKey="store"
              tick={(props: { x: number | string; y: number | string; payload: { value: string } }) => {
                const focus = data.find((d) => d.store === props.payload.value)?.focus;
                return (
                  <text x={Number(props.x)} y={Number(props.y) + 4} textAnchor="end" fontSize={13} fontWeight={focus ? 700 : 400} fill={focus ? palette.navy : palette.secondary}>
                    {props.payload.value}
                  </text>
                );
              }}
              tickLine={false}
              axisLine={false}
              interval={0}
              width={84}
            />
            <Scatter dataKey="actual" fill={palette.navy} shape={(p: { cx?: number; cy?: number }) => <rect x={(p.cx ?? 0) - 1.5} y={(p.cy ?? 0) - 10} width={3} height={20} rx={1} fill={palette.navy} />} isAnimationActive={false} />
            <Scatter dataKey="pooled" fill={bc} isAnimationActive={false}>
              <ErrorBar dataKey="err" direction="x" width={6} strokeWidth={2} stroke={bc} />
            </Scatter>
            <Scatter dataKey="raw" fill={palette.surface} stroke={palette.secondary} strokeWidth={2} isAnimationActive={false} />
            <Tooltip formatter={(v: unknown) => (Array.isArray(v) ? "" : f.dec1(Number(v)))} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${palette.divider}` }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[0.8rem] text-navy mt-1 leading-snug tnum">{t("how.poolingErr", { raw: f.dec1(avg("raw")), pooled: f.dec1(avg("pooled")) })}</div>
    </Panel>
  );
}

function Needs() {
  const { t } = useApp();
  const colors = [palette.royal, palette.amber, palette.indigo, palette.teal];
  return (
    <Panel className="min-w-0 px-4 py-3" delay={240}>
      <SectionTitle>{t("how.needsTitle")}</SectionTitle>
      <ul className="flex flex-col divide-y divide-line">
        {[1, 2, 3, 4].map((n, i) => (
          <li key={n} className="py-2 text-[0.86rem] text-navy flex gap-2.5 items-start">
            <span className="mt-[0.1rem] w-5 h-5 rounded-md shrink-0 text-[0.72rem] font-semibold flex items-center justify-center tnum" style={{ background: tint(colors[i], 0.18), color: palette.navy }}>
              {n}
            </span>
            <span>{t(`how.need${n}`)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
