"use client";
import { useState } from "react";
import { CartesianGrid, ComposedChart, ErrorBar, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis, ReferenceArea } from "recharts";
import { useApp } from "@/state/AppState";
import { SectionTitle } from "@/components/ui";

const STEPS = [1, 2, 3, 4, 5] as const;

export default function HowItWorks() {
  const { t, present } = useApp();
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const showAll = present;
  return (
    <div className="flex-1 min-h-0 flex flex-col px-8 pt-4 pb-3 overflow-y-auto">
      <div className="flex items-baseline gap-4 mb-2">
        <h1 className="text-[1.5rem] font-semibold text-ink leading-tight">{t("how.title")}</h1>
        <span className="text-[0.95rem] text-muted">{t("how.subtitle")}</span>
      </div>
      <div className="grid grid-cols-5 gap-0 mb-2">
        {STEPS.map((n, i) => {
          const isOpen = showAll || open[n];
          return (
            <div key={n} className="relative pr-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-full bg-navy text-white text-[0.85rem] font-semibold flex items-center justify-center tnum shrink-0">{n}</span>
                <div className="flex-1 h-px bg-line" />
                {i < STEPS.length - 1 && <span className="text-teal text-[1.1rem] leading-none -mr-4">▶</span>}
              </div>
              <div className="text-[1rem] font-semibold text-ink leading-snug min-h-[2.5em]">{t(`how.step${n}`)}</div>
              <div className="text-[0.85rem] text-muted leading-snug mt-0.5 min-h-[2.5em]">{t(`how.step${n}Desc`)}</div>
              <button className="mt-1 text-[0.78rem] font-medium text-teal-ink hover:underline" onClick={() => setOpen((o) => ({ ...o, [n]: !o[n] }))} disabled={showAll}>
                {t("how.tech")} {showAll ? "" : isOpen ? "▾" : "▸"}
              </button>
              {isOpen && <div className="mt-1 text-[0.74rem] leading-[1.38] text-ink bg-white border border-line rounded-sm px-2.5 py-1">{t(`how.tech${n}`)}</div>}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-[1.25fr_1fr_0.62fr] gap-8 flex-1 min-h-0 border-t border-line pt-2.5">
        <Backtest />
        <Pooling />
        <Needs />
      </div>
    </div>
  );
}

function Backtest() {
  const { t, f, backtest, brandName } = useApp();
  const fit = backtest.fitMonths;
  const data = backtest.series.slice(fit - 9).map((p) => ({ label: f.monthShort(p.cal, p.year), actual: p.actual, model: p.model, naive: p.naive, test: p.idx >= fit }));
  const firstTest = data.find((d) => d.test)?.label;
  const lastLabel = data[data.length - 1].label;
  const vals = data.flatMap((d) => [d.actual, d.model ?? d.actual, d.naive ?? d.actual]);
  const lo = Math.floor(Math.min(...vals) / 100) * 100;
  const hi = Math.ceil(Math.max(...vals) / 100) * 100;
  const yDomain: [number, number] = [lo, hi];
  const yTicks = Array.from({ length: Math.round((hi - lo) / 100) + 1 }, (_, i) => lo + i * 100).filter((_, i, a) => a.length <= 6 || i % 2 === 0);
  return (
    <section className="min-w-0 flex flex-col">
      <SectionTitle sub={t("how.backtestSub")}>{t("how.backtestTitle")}</SectionTitle>
      <div className="flex gap-8 items-end">
        <div>
          <div className="text-[0.8rem] text-muted whitespace-nowrap">{t("how.wapeModel")}</div>
          <div className="kpi-value text-[1.65rem] font-semibold text-teal-ink leading-tight">{f.pct1(backtest.wape.model)}</div>
        </div>
        <div>
          <div className="text-[0.8rem] text-muted whitespace-nowrap">{t("how.wapeNaive")}</div>
          <div className="kpi-value text-[1.65rem] font-semibold text-muted leading-tight">{f.pct1(backtest.wape.naive)}</div>
        </div>
        <div className="text-[0.76rem] text-muted pb-1.5 leading-snug">{t("how.naiveNote")}</div>
      </div>
      <div className="grid grid-cols-[1fr_8.6rem] gap-4 mt-1">
        <div className="min-w-0">
          <div className="text-[0.85rem] font-medium text-ink">{t("how.groupSales")}</div>
          <div className="h-[10.6rem]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -6 }}>
                <CartesianGrid stroke="#eef1f5" vertical={false} />
                {firstTest && <ReferenceArea x1={firstTest} x2={lastLabel} fill="#e2f3f3" fillOpacity={0.6} />}
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#586777" }} tickLine={false} axisLine={{ stroke: "#dde3ea" }} interval={1} />
                <YAxis tick={{ fontSize: 12, fill: "#586777" }} tickLine={false} axisLine={false} width={44} domain={yDomain} ticks={yTicks} tickFormatter={(v: number) => f.int(v)} />
                <Line dataKey="actual" name={t("series.actual")} stroke="#16202b" strokeWidth={2.2} dot={{ r: 2.5 }} isAnimationActive={false} />
                <Line dataKey="model" name={t("series.model")} stroke="#0fa3a3" strokeWidth={2.6} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                <Line dataKey="naive" name={t("series.naive")} stroke="#8a97a6" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} verticalAlign="top" height={22} />
                <Tooltip formatter={(v: unknown) => f.int(Number(v))} contentStyle={{ fontSize: 12 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <div className="text-[0.85rem] font-medium text-ink">{t("how.byBrand")}</div>
          <table className="w-full text-[0.8rem] tnum">
            <thead>
              <tr className="text-[0.72rem] text-faint">
                <th />
                <th className="text-right font-normal">{t("series.model")}</th>
                <th className="text-right font-normal pl-1">{t("how.naiveShort")}</th>
              </tr>
            </thead>
            <tbody>
              {backtest.byBrand.map((b) => (
                <tr key={b.brand} className="border-t border-line-2">
                  <td className="py-[3px] text-muted">{brandName(b.brand)}</td>
                  <td className={`py-[3px] text-right font-semibold ${b.model <= b.naive ? "text-teal-ink" : "text-ink"}`}>{f.pct(b.model)}</td>
                  <td className="py-[3px] text-right text-faint">{f.pct(b.naive)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Pooling() {
  const { t, f, backtest, storeName, modelName, units, brandName } = useApp();
  const story = units.find((u) => u.storyId === 3);
  const modelId = story?.model ?? "Z7";
  const storyStore = story?.store ?? "COY";
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
    <section className="min-w-0 flex flex-col">
      <SectionTitle sub={row ? t(row.months === 1 ? "how.poolingSubOne" : "how.poolingSubMany", { model: `${brand} ${modelName(modelId)}`, store: storeName(storyStore), months: row.months }) : undefined}>
        {t("how.poolingTitle")}
      </SectionTitle>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.75rem] text-muted mb-1">
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-[#8a97a6] bg-white" />{t("how.raw")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-teal" />{t("how.pooled")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-[3px] bg-ink" />{t("how.actual")}</span>
      </div>
      <div className="h-[10.2rem]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} layout="vertical" margin={{ top: 12, right: 16, bottom: 14, left: 0 }}>
            <CartesianGrid stroke="#eef1f5" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: "#586777" }} tickLine={false} axisLine={{ stroke: "#dde3ea" }} domain={[0, "dataMax + 3"]} tickFormatter={(v: number) => f.int(v)} label={{ value: t("how.poolingUnit"), position: "insideBottomRight", offset: -8, fontSize: 12, fill: "#8794a3" }} />
            <YAxis
              type="category"
              dataKey="store"
              tick={(props: { x: number | string; y: number | string; payload: { value: string } }) => {
                const focus = data.find((d) => d.store === props.payload.value)?.focus;
                return (
                  <text x={Number(props.x)} y={Number(props.y) + 4} textAnchor="end" fontSize={13} fontWeight={focus ? 700 : 400} fill={focus ? "#0a7676" : "#586777"}>
                    {props.payload.value}
                  </text>
                );
              }}
              tickLine={false}
              axisLine={false}
              interval={0}
              width={84}
            />
            <Scatter dataKey="actual" fill="#16202b" shape={(p: { cx?: number; cy?: number }) => <rect x={(p.cx ?? 0) - 1.5} y={(p.cy ?? 0) - 10} width={3} height={20} fill="#16202b" />} isAnimationActive={false} />
            <Scatter dataKey="pooled" fill="#0fa3a3" isAnimationActive={false}>
              <ErrorBar dataKey="err" direction="x" width={6} strokeWidth={2} stroke="#0fa3a3" />
            </Scatter>
            <Scatter dataKey="raw" fill="#ffffff" stroke="#8a97a6" strokeWidth={2} isAnimationActive={false} />
            <Tooltip formatter={(v: unknown) => (Array.isArray(v) ? "" : f.dec1(Number(v)))} contentStyle={{ fontSize: 12 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[0.82rem] text-ink mt-1 leading-snug tnum">{t("how.poolingErr", { raw: f.dec1(avg("raw")), pooled: f.dec1(avg("pooled")) })}</div>
    </section>
  );
}

function Needs() {
  const { t } = useApp();
  return (
    <section className="min-w-0">
      <SectionTitle>{t("how.needsTitle")}</SectionTitle>
      <ul className="flex flex-col divide-y divide-line-2 border-y border-line">
        {[1, 2, 3, 4].map((n) => (
          <li key={n} className="py-2 text-[0.88rem] text-ink flex gap-2.5">
            <span className="text-teal font-semibold tnum">{n}</span>
            <span>{t(`how.need${n}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
