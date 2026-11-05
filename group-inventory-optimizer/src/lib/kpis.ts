/** Panorama KPIs. Unit-level facts plus plan and approved deltas from full scenario evaluation. */
import type { PlanAction, Unit } from "./types";
import type { EconContext } from "./economics";
import { deltas, evaluateScenario, type ScenarioTotals } from "./scenario";

export const AGING_BUCKETS = [
  { key: "b0", min: 0, max: 30 },
  { key: "b1", min: 31, max: 60 },
  { key: "b2", min: 61, max: 90 },
  { key: "b3", min: 91, max: Infinity },
] as const;

export function bucketOf(age: number): number {
  return age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3;
}

export interface StoreStats {
  store: string;
  units: number;
  value: number;
  buckets: number[];
  over90: number;
  over90Share: number;
  avgDays: number;
  monthlyFloorplan: number;
}

export interface PanoramaKpis {
  units: number;
  inventoryValue: number;
  avgDays: number;
  over90: number;
  over90Share: number;
  monthlyFloorplan: number; // current run rate: cost x annual rate / 12
  monthlyFloorplanApproved: number; // run rate minus approved monthly savings
  planSavings: number;
  approvedSavings: number;
  planCapital: number;
  approvedCapital: number;
  approvedCount: number;
  stores: StoreStats[];
}

export function storeStats(ctx: EconContext, units: Unit[]): StoreStats[] {
  return ctx.world.stores.map((s) => {
    const us = units.filter((u) => u.store === s.id);
    const buckets = [0, 0, 0, 0];
    let value = 0;
    let days = 0;
    for (const u of us) {
      buckets[bucketOf(u.age)]++;
      value += u.cost;
      days += u.age;
    }
    return {
      store: s.id,
      units: us.length,
      value,
      buckets,
      over90: buckets[3],
      over90Share: us.length ? buckets[3] / us.length : 0,
      avgDays: us.length ? days / us.length : 0,
      monthlyFloorplan: (value * ctx.a.floorplanRate) / 12,
    };
  });
}

export function computeKpis(
  ctx: EconContext,
  units: Unit[],
  base: ScenarioTotals,
  plan: ScenarioTotals,
  approved: PlanAction[],
): PanoramaKpis {
  const stores = storeStats(ctx, units);
  const value = units.reduce((a, u) => a + u.cost, 0);
  const days = units.reduce((a, u) => a + u.age, 0);
  const over90 = units.filter((u) => u.age > 90).length;
  const planD = deltas(base, plan);
  const appD = approved.length ? deltas(base, evaluateScenario(ctx, units, approved).totals) : { monthlyFloorplanSavings: 0, capitalFreed90: 0, evGain: 0 };
  const monthlyFloorplan = (value * ctx.a.floorplanRate) / 12;
  return {
    units: units.length,
    inventoryValue: value,
    avgDays: days / units.length,
    over90,
    over90Share: over90 / units.length,
    monthlyFloorplan,
    monthlyFloorplanApproved: monthlyFloorplan - appD.monthlyFloorplanSavings,
    planSavings: planD.monthlyFloorplanSavings,
    approvedSavings: appD.monthlyFloorplanSavings,
    planCapital: planD.capitalFreed90,
    approvedCapital: appD.capitalFreed90,
    approvedCount: approved.length,
    stores,
  };
}
