/**
 * Forward 90-day projections for KPI sparklines, from the same survival curves the plan uses.
 * Read-only: does not change any model output.
 */
import type { Unit } from "./types";
import { survivalAt, type SeasonCurves } from "./demand";
import type { ScenarioResult } from "./scenario";

export const PROJECTION_DAYS = [0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84, 90];

export interface ProjectionPoint {
  day: number;
  units: number;
  value: number;
  avgAge: number;
  over90: number;
  monthlyFloorplan: number;
  capitalSold: number; // cumulative cost value sold
}

export function project(curves: SeasonCurves, units: Unit[], s: ScenarioResult, floorplanRate: number): ProjectionPoint[] {
  return PROJECTION_DAYS.map((day) => {
    let n = 0;
    let value = 0;
    let ageSum = 0;
    let over90 = 0;
    let sold = 0;
    for (const u of units) {
      const v = s.values[u.id];
      const surv = survivalAt(curves, u.brand, v.dailyRate, v.transit, day);
      n += surv;
      value += surv * u.cost;
      ageSum += surv * (u.age + day);
      if (u.age + day > 90) over90 += surv;
      sold += (1 - surv) * u.cost;
    }
    return { day, units: n, value, avgAge: ageSum / Math.max(n, 1e-9), over90, monthlyFloorplan: (value * floorplanRate) / 12, capitalSold: sold };
  });
}
