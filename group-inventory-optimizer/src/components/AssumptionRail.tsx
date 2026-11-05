"use client";
import { useApp } from "@/state/AppState";
import { DEFAULT_ASSUMPTIONS } from "@/lib/economics";
import type { Assumptions, Segment } from "@/lib/types";
import { Button } from "./ui";

type Key = Exclude<keyof Assumptions, "elasticity">;

export function AssumptionRail() {
  const { t, f, assumptions, dispatch, pendingRecalc, engine } = useApp();
  const fmt: Record<Key, (v: number) => string> = {
    floorplanRate: (v) => f.pct1(v),
    weeklyCapacity: (v) => t("asm.unitsValue", { n: v }),
    costPerKm: (v) => f.money(v),
    fixedTransferCost: (v) => f.money(v),
    maxDiscount: (v) => f.pct(v),
    minImprovement: (v) => f.money(v),
  };
  const ranges: Record<Key, [number, number, number]> = {
    floorplanRate: [0.06, 0.2, 0.005],
    weeklyCapacity: [0, 80, 1],
    costPerKm: [0, 60, 1],
    fixedTransferCost: [0, 8000, 250],
    maxDiscount: [0, 0.15, 0.01],
    minImprovement: [0, 20000, 500],
  };
  const keys = Object.keys(ranges) as Key[];
  const segs: Segment[] = ["volume", "newEntrant", "premium", "luxury"];
  return (
    <aside className="w-[19rem] shrink-0 border-r border-line bg-surface shadow-[2px_0_12px_rgb(11_31_58/0.04)] px-5 py-4 overflow-y-auto scroll-thin">
      <div className="flex items-center justify-between">
        <h2 className="text-[1rem] font-semibold text-navy">{t("plan.assumptions")}</h2>
        <Button small variant="secondary" onClick={() => dispatch({ type: "reset" })}>
          {t("btn.reset")}
        </Button>
      </div>
      <p className="text-[0.8rem] text-muted mt-1 mb-3">{t("plan.assumptionsNote")}</p>
      <div className="flex flex-col divide-y divide-line-2">
        {keys.map((k) => {
          const [min, max, step] = ranges[k];
          const v = assumptions[k];
          const changed = Math.abs(v - DEFAULT_ASSUMPTIONS[k]) > 1e-9;
          return (
            <label key={k} className="py-2.5 block">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[0.88rem] text-navy">{t(`asm.${k}`)}</span>
                <span className={`text-[0.9rem] font-semibold tnum ${changed ? "text-deep-teal" : "text-navy"}`}>{fmt[k](v)}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={v}
                onChange={(e) => dispatch({ type: "setAssumption", key: k, value: Number(e.target.value) })}
                className="w-full accent-teal mt-1"
              />
              <div className="text-[0.75rem] text-faint tnum">{t("plan.default", { value: fmt[k](DEFAULT_ASSUMPTIONS[k]) })}</div>
            </label>
          );
        })}
        <div className="py-2.5">
          <div className="text-[0.88rem] text-navy">{t("asm.elasticity")}</div>
          {segs.map((s) => {
            const v = assumptions.elasticity[s];
            const changed = v !== DEFAULT_ASSUMPTIONS.elasticity[s];
            return (
              <label key={s} className="block mt-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[0.82rem] text-muted">{t(`seg.${s}`)}</span>
                  <span className={`text-[0.85rem] font-semibold tnum ${changed ? "text-deep-teal" : "text-navy"}`}>{v}</span>
                </div>
                <input type="range" min={0} max={40} step={1} value={v} onChange={(e) => dispatch({ type: "setElasticity", segment: s, value: Number(e.target.value) })} className="w-full accent-teal" />
                <div className="text-[0.75rem] text-faint tnum">
                  {t("asm.elasticityNote", { pct: f.pct(Math.exp(v * 0.01) - 1) })}. {t("plan.default", { value: DEFAULT_ASSUMPTIONS.elasticity[s] })}
                </div>
              </label>
            );
          })}
        </div>
      </div>
      <div className="text-[0.75rem] text-faint mt-2 tnum">{pendingRecalc ? t("plan.recalculating") : t("plan.runtime", { ms: f.int(engine.result.runtimeMs) })}</div>
    </aside>
  );
}
