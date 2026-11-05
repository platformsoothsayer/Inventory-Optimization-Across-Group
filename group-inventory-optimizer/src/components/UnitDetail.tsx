"use client";
import { useMemo } from "react";
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { useApp } from "@/state/AppState";
import { explainUnit, type Driver, type Explanation } from "@/lib/explain";
import { Badge, Button } from "./ui";
import { actionLabel, bodyLabel, configLabel } from "./labels";
import { explanationText } from "./explainText";

const CURVE_COLORS = { chosen: "#0fa3a3", keep: "#586777", alt1: "#2a4a78", alt2: "#9db0c6" };

export function UnitDetail({ unitId, onClose }: { unitId: string; onClose: () => void }) {
  const app = useApp();
  const { t, f, units, engine, groups, actionByUnit, statusOf, dispatch, storeName, world, present } = app;
  const u = units.find((x) => x.id === unitId);
  const action = u ? actionByUnit.get(u.id) : undefined;
  const e = useMemo(() => (u ? explainUnit(engine.ctx, units, u, action, groups) : null), [u, engine, units, action, groups]);
  if (!u || !e) return null;
  const status = action ? statusOf(action.id) : null;
  const text = explanationText(app, e);

  return (
    <div className="absolute inset-y-0 right-0 w-[78%] bg-white border-l border-line shadow-[-12px_0_32px_rgba(11,31,58,0.10)] flex flex-col z-20">
      <div className="px-6 pt-4 pb-3 border-b border-line flex items-start gap-6">
        <div className="min-w-0 flex-1">
          <div className="text-[0.8rem] text-muted font-mono">{u.id}</div>
          <div className="text-[1.3rem] font-semibold text-ink leading-tight">{configLabel(app, u)}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[0.85rem] text-muted tnum">
            <span className="text-ink font-medium">{storeName(u.store)}</span>
            <span>{bodyLabel(app, world, u.model)}</span>
            <span className={u.age > 90 ? "text-[#8a2f1e] font-semibold" : ""}>{t("detail.daysInStock", { n: u.age })}</span>
            <span>{t("detail.cost", { value: f.money(u.cost) })}</span>
            <span>{t("detail.msrp", { value: f.money(u.msrp) })}</span>
            <span>{t("detail.accumulated", { value: f.money(e.accumulatedFloorplan) })}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[0.75rem] text-muted uppercase tracking-wide">{t("detail.recommendation")}</div>
          <div className={`text-[1.15rem] font-semibold ${action ? "text-teal-ink" : "text-ink"}`}>{actionLabel(app, action)}</div>
          {action && <div className="text-[0.85rem] tnum text-ink">{t("col.improvement")}: <span className="font-semibold">{f.money(action.improvement)}</span></div>}
          {action && (
            <div className="flex gap-2 justify-end mt-2">
              {status === "proposed" ? (
                <>
                  <Button small onClick={() => dispatch({ type: "approve", ids: [action.id] })}>{t("btn.approve")}</Button>
                  <Button small variant="secondary" onClick={() => dispatch({ type: "reject", id: action.id })}>{t("btn.reject")}</Button>
                </>
              ) : (
                <>
                  <Badge tone={status === "approved" ? "approved" : "rejected"}>{t(`status.${status}`)}</Badge>
                  <Button small variant="secondary" onClick={() => dispatch({ type: "undo", id: action.id })}>{t("btn.undo")}</Button>
                </>
              )}
            </div>
          )}
        </div>
        {!present && (
          <button onClick={onClose} className="text-muted hover:text-ink text-[1.3rem] leading-none -mr-2 px-2" aria-label={t("btn.close")}>
            ×
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin px-6 py-4">
        <p className="text-[0.95rem] leading-relaxed text-ink border-l-[3px] border-teal bg-teal-soft/60 pl-4 pr-3 py-2 mb-3">{text}</p>
        <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-7">
          <div className="min-w-0">
            <Curves e={e} />
          </div>
          <div className="min-w-0">
            <Drivers e={e} />
            <DemandByStore e={e} />
          </div>
          <div className="min-w-0">
            <WaterfallView e={e} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Curves({ e }: { e: Explanation }) {
  const { t, f, storeName } = useApp();
  const chosenKey = e.chosen.kind === "keep" ? "keep" : e.chosen.kind === "transfer" ? `t:${e.chosen.store}` : `d:${e.chosen.discount}`;
  const others = e.curves.filter((c) => c.key !== "keep" && c.key !== chosenKey);
  const colorOf = (key: string) => (key === chosenKey ? CURVE_COLORS.chosen : key === "keep" ? CURVE_COLORS.keep : key === others[0]?.key ? CURVE_COLORS.alt1 : CURVE_COLORS.alt2);
  const labelOf = (c: Explanation["curves"][number]) =>
    c.key === "keep" ? t("detail.curveKeep", { store: storeName(c.store) }) : c.key.startsWith("t:") ? t("detail.curveTransfer", { store: storeName(c.store) }) : t("detail.curveDiscount", { pct: f.pct(c.discount) });
  const data = Array.from({ length: 121 }, (_, d) => {
    const row: Record<string, number | number[]> = { day: d };
    for (const c of e.curves) {
      row[c.key] = c.mean[d];
      row[`${c.key}_band`] = [c.lo[d], c.hi[d]];
    }
    return row;
  });
  const order = [...e.curves].sort((a, b) => (a.key === chosenKey ? 1 : b.key === chosenKey ? -1 : 0));
  const p60 = (key: string) => e.curves.find((c) => c.key === key)!.mean[60];
  return (
    <div>
      <div className="text-[1rem] font-semibold text-ink">{t("detail.curvesTitle")}</div>
      <div className="text-[0.8rem] text-muted mb-1">{t("detail.curvesSub")}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] mb-1">
        {e.curves.map((c) => (
          <span key={c.key} className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-[3px]" style={{ background: colorOf(c.key) }} />
            <span className={c.key === chosenKey ? "font-semibold text-ink" : "text-muted"}>{labelOf(c)}</span>
            <span className="tnum text-muted">{f.pct(p60(c.key))}</span>
          </span>
        ))}
      </div>
      <div className="h-[15rem]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
            <CartesianGrid stroke="#eef1f5" vertical={false} />
            <XAxis dataKey="day" type="number" domain={[0, 120]} ticks={[0, 30, 60, 90, 120]} tick={{ fontSize: 13, fill: "#586777" }} tickLine={false} axisLine={{ stroke: "#dde3ea" }} label={{ value: t("detail.dayAxis"), position: "insideBottom", offset: -10, fontSize: 12, fill: "#8794a3" }} />
            <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v: number) => f.pct(v)} tick={{ fontSize: 13, fill: "#586777" }} tickLine={false} axisLine={false} width={46} />
            <ReferenceLine x={60} stroke="#c9d2dc" strokeDasharray="3 3" />
            {order.map((c) => (
              <Area key={`${c.key}_band`} dataKey={`${c.key}_band`} stroke="none" fill={colorOf(c.key)} fillOpacity={c.key === chosenKey ? 0.16 : 0.08} isAnimationActive={false} />
            ))}
            {order.map((c) => (
              <Line key={c.key} dataKey={c.key} stroke={colorOf(c.key)} strokeWidth={c.key === chosenKey ? 3 : 2} dot={false} isAnimationActive={false} strokeDasharray={c.key === "keep" ? "0" : undefined} />
            ))}
            <Tooltip
              formatter={(v: unknown, name: unknown) => {
                if (Array.isArray(v)) return [null, null];
                const c = e.curves.find((x) => x.key === name);
                return [f.pct(Number(v)), c ? labelOf(c) : String(name)];
              }}
              labelFormatter={(d) => t("detail.dayN", { n: String(d) })}
              contentStyle={{ fontSize: 12 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-4 text-[0.85rem]">
        <Stat label={t("detail.p60")} a={f.pct(e.keep.value.p60)} b={f.pct(e.chosen.value.p60)} changed={e.chosen !== e.keep} />
        <Stat label={t("detail.expectedDays")} a={f.int(e.keep.daysToSell)} b={f.int(e.chosen.daysToSell)} changed={e.chosen !== e.keep} />
      </div>
    </div>
  );
}

function Stat({ label, a, b, changed }: { label: string; a: string; b: string; changed: boolean }) {
  const { t } = useApp();
  return (
    <div className="border-t border-line pt-1.5">
      <div className="text-muted text-[0.8rem]">{label}</div>
      <div className="tnum text-ink whitespace-nowrap" title={`${t("detail.today")} ${a}${changed ? `, ${t("detail.withAction")} ${b}` : ""}`}>
        <span className="font-semibold text-[1.05rem]">{a}</span>
        {changed && (
          <>
            <span className="text-faint mx-2">→</span>
            <span className="font-semibold text-[1.05rem] text-teal-ink">{b}</span>
          </>
        )}
      </div>
    </div>
  );
}

function DemandByStore({ e }: { e: Explanation }) {
  const { t, f, storeName, modelName } = useApp();
  const max = Math.max(...e.demandByStore.map((d) => d.q90));
  return (
    <div className="mt-3">
      <div className="text-[1rem] font-semibold text-ink">{t("detail.demandTitle", { model: modelName(e.unit.model) })}</div>
      <div className="text-[0.8rem] text-muted mb-1.5">{t("detail.demandUnit")}</div>
      <div className="flex flex-col gap-[3px]">
        {e.demandByStore.map((d) => {
          const isFrom = d.store === e.unit.store;
          const isTo = d.store === e.chosen.store && e.chosen.kind === "transfer";
          return (
            <div key={d.store} className="grid grid-cols-[6.5rem_1fr_2.6rem] items-center gap-2 text-[0.82rem]">
              <span className={`truncate ${isFrom || isTo ? "font-semibold text-ink" : "text-muted"}`}>{storeName(d.store)}</span>
              <div className="relative h-3">
                <div className="absolute top-0 h-3 rounded-sm" style={{ left: 0, width: `${(d.rate / max) * 100}%`, background: isTo ? "#0fa3a3" : isFrom ? "#586777" : "#c9d3de" }} />
                <div className="absolute top-[5px] h-[2px] bg-ink/50" style={{ left: `${(d.q10 / max) * 100}%`, width: `${((d.q90 - d.q10) / max) * 100}%` }} />
              </div>
              <span className="tnum text-right">{f.dec1(d.rate)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function driverText(app: ReturnType<typeof useApp>, e: Explanation, d: Driver): string {
  const { t, f, storeName, modelName } = app;
  const transfer = e.chosen.kind === "transfer";
  const from = storeName(e.keep.store);
  const to = storeName(e.chosen.store);
  if (d.key === "seasonAhead") return d.to >= 1 ? t("driver.seasonUp", { pct: f.pct(d.to - 1) }) : t("driver.seasonDown", { pct: f.pct(1 - d.to) });
  const fmtV = (v: number) => (d.key === "modelDemand" ? f.dec1(v) : d.key === "configFit" ? f.pct1(v) : f.int(v));
  if (transfer) return t(`driverT.${d.key}`, { model: modelName(e.unit.model), from, to, a: fmtV(d.from), b: fmtV(d.to) });
  return t(`driverK.${d.key}`, { model: modelName(e.unit.model), store: from, a: fmtV(d.from), b: fmtV(d.to) });
}

function Drivers({ e }: { e: Explanation }) {
  const app = useApp();
  const { t, f } = app;
  const maxLog = Math.max(Math.log(2), ...e.drivers.map((d) => Math.abs(Math.log(d.factor))));
  return (
    <div>
      <div className="text-[1rem] font-semibold text-ink mb-2">{t("detail.driversTitle")}</div>
      <div className="flex flex-col divide-y divide-line-2">
        {e.drivers.map((d) => {
          const lg = Math.log(d.factor);
          const w = (Math.abs(lg) / maxLog) * 50;
          return (
            <div key={d.key} className="py-2 grid grid-cols-[1fr_7.5rem] gap-3 items-center">
              <div className="min-w-0">
                <div className="text-[0.88rem] font-medium text-ink">{t(`driver.${d.key}`)}</div>
                <div className="text-[0.8rem] text-muted leading-snug tnum">{driverText(app, e, d)}</div>
              </div>
              <div>
                <div className="relative h-2.5 bg-line-2 rounded-sm">
                  <div className="absolute top-0 bottom-0 w-px bg-faint" style={{ left: "50%" }} />
                  <div className="absolute top-0 h-2.5 rounded-sm" style={{ left: lg >= 0 ? "50%" : `${50 - w}%`, width: `${w}%`, background: lg >= 0 ? "#0fa3a3" : "#8a97a6" }} />
                </div>
                <div className={`text-[0.85rem] tnum text-right mt-0.5 font-semibold ${lg >= 0 ? "text-teal-ink" : "text-muted"}`}>{f.pctSigned(d.factor - 1)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WaterfallView({ e }: { e: Explanation }) {
  const { t, f } = useApp();
  if (e.chosen.kind === "keep") {
    return (
      <div>
        <div className="text-[1rem] font-semibold text-ink mb-1">{t("detail.waterfallTitle")}</div>
        <div className="text-[0.88rem] text-muted">{t("detail.noAction")}</div>
        <OptionsList e={e} />
      </div>
    );
  }
  const w = e.waterfall;
  const items = [
    { k: "wf.margin", v: w.marginEffect },
    { k: "wf.floorplan", v: w.floorplanAvoided },
    { k: "wf.aging", v: w.agingAvoided },
    { k: "wf.transfer", v: w.transferCost },
    { k: "wf.discount", v: w.discountCost },
    { k: "wf.others", v: w.otherUnits },
  ].filter((x) => Math.abs(x.v) >= 1);
  let run = 0;
  const bars = items.map((x) => {
    const start = run;
    run += x.v;
    return { ...x, start, end: run };
  });
  const lo = Math.min(0, ...bars.map((b) => Math.min(b.start, b.end)));
  const hi = Math.max(0, w.net, ...bars.map((b) => Math.max(b.start, b.end)));
  const span = hi - lo || 1;
  const pos = (v: number) => ((v - lo) / span) * 100;
  return (
    <div>
      <div className="text-[1rem] font-semibold text-ink mb-2">{t("detail.waterfallTitle")}</div>
      <div className="flex flex-col gap-2.5">
        {bars.map((b) => (
          <div key={b.k} className="grid grid-cols-[8.5rem_1fr_5.4rem] items-center gap-2 text-[0.82rem]">
            <span className="text-muted leading-tight">{t(b.k)}</span>
            <div className="relative h-4">
              <div className="absolute top-0 bottom-0 w-px bg-line" style={{ left: `${pos(0)}%` }} />
              <div className="absolute top-0 h-4 rounded-sm" style={{ left: `${pos(Math.min(b.start, b.end))}%`, width: `${Math.max(0.6, (Math.abs(b.v) / span) * 100)}%`, background: b.v >= 0 ? "#0fa3a3" : "#8a97a6" }} />
            </div>
            <span className={`tnum text-right ${b.v >= 0 ? "text-ink" : "text-muted"}`}>{f.moneySigned(b.v)}</span>
          </div>
        ))}
        <div className="grid grid-cols-[8.5rem_1fr_5.4rem] items-center gap-2 text-[0.85rem] border-t border-line pt-1.5">
          <span className="font-semibold text-ink">{t("wf.net")}</span>
          <div className="relative h-4">
            <div className="absolute top-0 h-4 rounded-sm bg-navy" style={{ left: `${pos(Math.min(0, w.net))}%`, width: `${(Math.abs(w.net) / span) * 100}%` }} />
          </div>
          <span className="tnum text-right font-semibold text-ink">{f.moneySigned(w.net)}</span>
        </div>
      </div>
      <OptionsList e={e} />
    </div>
  );
}

function OptionsList({ e }: { e: Explanation }) {
  const { t, f, storeName } = useApp();
  const transfers = e.options.filter((o) => o.kind === "transfer").sort((a, b) => b.value.ev - a.value.ev).slice(0, 3);
  const opts = [e.keep, ...transfers, ...(e.bestDiscount ? [e.bestDiscount] : [])].sort((a, b) => b.value.ev - a.value.ev);
  return (
    <div className="mt-5">
      <div className="text-[0.85rem] font-medium text-ink mb-1">{t("detail.optionsTitle")}</div>
      <table className="w-full text-[0.82rem] tnum">
        <thead>
          <tr className="text-[0.75rem] text-faint">
            <th />
            <th className="text-right font-normal">{t("detail.p60Short")}</th>
            <th className="text-right font-normal">{t("detail.evLabel")}</th>
          </tr>
        </thead>
        <tbody>
          {opts.map((o) => (
            <tr key={`${o.kind}${o.store}${o.discount}`} className={`border-t border-line-2 ${o === e.chosen ? "font-semibold text-teal-ink" : ""}`}>
              <td className={`py-1 ${o === e.chosen ? "" : "text-muted"}`}>
                {o.kind === "keep" ? t("action.keep") : o.kind === "transfer" ? t("action.transfer", { store: storeName(o.store) }) : t("action.discount", { pct: f.pct(o.discount) })}
              </td>
              <td className="py-1 text-right w-16">{f.pct(o.value.p60)}</td>
              <td className="py-1 text-right font-medium w-28">{f.money(o.value.ev)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
