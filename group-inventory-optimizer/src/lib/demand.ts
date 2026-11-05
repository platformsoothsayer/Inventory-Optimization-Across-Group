/**
 * Demand model.
 * - Gamma-Poisson hierarchical rate per dealership and model with empirical Bayes prior strength.
 * - Exponential recency weighting (half-life 6 months).
 * - Multiplicative calendar seasonality per season group, estimated from established brands.
 * - Dirichlet-smoothed trim and color shares per dealership.
 * - Queue-aware unit hazard and seasonal survival curves.
 */
import type { SeasonGroup, World } from "./types";
import { calMonthOfIndex, DAYS_PER_MONTH, forwardDayMonths } from "./calendar";

export const HALF_LIFE_MONTHS = 6;
export const TRIM_COLOR_PRIOR = 40; // Dirichlet concentration toward group shares
export const AFFINITY_PSEUDO = 20; // pseudo-sales shrinking brand affinity toward 1
export const SEASON_SHRINK = 0.5; // pseudo-years shrinking month indices toward 1
export const Z80 = 1.2815515655446004; // standard normal 90th percentile

export interface RateEstimate {
  mean: number; // posterior mean monthly rate, deseasonalized
  q10: number;
  q90: number;
  raw: number | null; // weighted raw rate (no pooling)
  priorMean: number;
  priorStrength: number; // a in Gamma(a, a / priorMean)
  shape: number;
  rate: number;
  monthsOfHistory: number;
}

export interface DemandModel {
  monthsUsed: number;
  /** Monthly log growth of new-entrant brands (0 for established brands), estimated from the group ramp. */
  growth: Record<string, number>;
  season: Record<SeasonGroup, number[]>; // 12 calendar month indices, mean 1
  rates: Record<string, Record<string, RateEstimate>>; // [store][model]
  affinity: Record<string, Record<string, number>>; // [store][brand], estimated
  groupRate: Record<string, number>; // per unit of traffic x affinity
  priorStrength: Record<string, number>; // per model
  trimShare: Record<string, number[]>;
  colorShare: Record<string, number[]>;
  groupTrim: number[];
  groupColor: number[];
}

/** Gamma quantile via Wilson-Hilferty, accurate enough for intervals in a business UI. */
export function gammaQuantile(shape: number, rate: number, z: number): number {
  const k = Math.max(shape, 0.05);
  const c = 1 / (9 * k);
  const x = k * Math.pow(Math.max(1 - c + z * Math.sqrt(c), 0.0), 3);
  return x / rate;
}

export function recencyWeight(idx: number, lastIdx: number): number {
  return Math.pow(0.5, (lastIdx - idx) / HALF_LIFE_MONTHS);
}

export function estimateSeason(world: World, monthsUsed: number): Record<SeasonGroup, number[]> {
  const out = {} as Record<SeasonGroup, number[]>;
  const established = new Set(world.brands.filter((b) => !b.launchMonth).map((b) => b.id));
  for (const g of ["volume", "premium"] as SeasonGroup[]) {
    const brandIds = new Set(world.brands.filter((b) => b.seasonGroup === g && established.has(b.id)).map((b) => b.id));
    const totals: number[] = [];
    for (let i = 0; i < monthsUsed; i++) {
      let t = 0;
      for (const s of world.stores)
        for (const m of world.models) if (brandIds.has(m.brand) && world.sales[s.id][m.id]) t += world.sales[s.id][m.id][i];
      totals.push(t);
    }
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    const sum = new Array(12).fill(0);
    const n = new Array(12).fill(0);
    totals.forEach((t, i) => {
      const c = calMonthOfIndex(world, i);
      sum[c] += t / mean;
      n[c] += 1;
    });
    let idx = sum.map((s, c) => (s + SEASON_SHRINK) / (n[c] + SEASON_SHRINK));
    const avg = idx.reduce((a, b) => a + b, 0) / 12;
    idx = idx.map((x) => x / avg);
    out[g] = idx;
  }
  return out;
}

export const GROWTH_WINDOW = 6;
export const GROWTH_CAP = 0.15;

/**
 * Launch trend for new-entrant brands: log-linear slope of the group's deseasonalized sales per unit of
 * traffic over the last months. Rates are then expressed at the level of the last fitted month.
 */
export function estimateGrowth(world: World, season: Record<SeasonGroup, number[]>, monthsUsed: number): Record<string, number> {
  const out: Record<string, number> = {};
  const last = monthsUsed - 1;
  for (const b of world.brands) {
    out[b.id] = 0;
    if (!b.launchMonth) continue;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = Math.max(b.launchMonth - 1, last - GROWTH_WINDOW + 1); i <= last; i++) {
      let t = 0;
      let traffic = 0;
      for (const s of world.stores) {
        if (!s.brands.includes(b.id) || i < world.brandStart[s.id][b.id]) continue;
        traffic += s.traffic;
        for (const m of world.models) if (m.brand === b.id) t += world.sales[s.id][m.id][i];
      }
      if (t <= 0 || traffic <= 0) continue;
      xs.push(i);
      ys.push(Math.log(t / traffic / season[b.seasonGroup][calMonthOfIndex(world, i)]));
    }
    if (xs.length < 3) continue;
    const mx = xs.reduce((a, c) => a + c, 0) / xs.length;
    const my = ys.reduce((a, c) => a + c, 0) / ys.length;
    let num = 0;
    let den = 0;
    xs.forEach((x, k) => {
      num += (x - mx) * (ys[k] - my);
      den += (x - mx) ** 2;
    });
    out[b.id] = Math.min(GROWTH_CAP, Math.max(0, num / den));
  }
  return out;
}

/** Forward growth multiplier after `months` months, trend held for at most 3 months. */
export function growthFactor(dm: DemandModel, brand: string, months: number): number {
  return Math.exp((dm.growth[brand] ?? 0) * Math.min(Math.max(months, 0), 3));
}

export function fitDemand(world: World, monthsUsed = world.months): DemandModel {
  const season = estimateSeason(world, monthsUsed);
  const last = monthsUsed - 1;
  const growth = estimateGrowth(world, season, monthsUsed);
  const brandOf = Object.fromEntries(world.models.map((m) => [m.id, m.brand]));
  const groupOf = Object.fromEntries(world.brands.map((b) => [b.id, b.seasonGroup]));

  // Weighted sums per store and model.
  type Acc = { Y: number; E: number; W2E: number; months: number };
  const acc: Record<string, Record<string, Acc>> = {};
  for (const s of world.stores) {
    acc[s.id] = {};
    for (const m of world.models) {
      if (!s.brands.includes(m.brand)) continue;
      const start = world.brandStart[s.id][m.brand];
      const a: Acc = { Y: 0, E: 0, W2E: 0, months: 0 };
      for (let i = start; i <= last; i++) {
        const w = recencyWeight(i, last);
        const e = season[groupOf[m.brand]][calMonthOfIndex(world, i)] * Math.exp(growth[m.brand] * (i - last));
        a.Y += w * world.sales[s.id][m.id][i];
        a.E += w * e;
        a.W2E += w * w * e;
        a.months++;
      }
      acc[s.id][m.id] = a;
    }
  }

  // Brand affinity per store, shrunk toward 1.
  const affinity: Record<string, Record<string, number>> = {};
  const groupBrandRate: Record<string, number> = {};
  for (const b of world.brands) {
    let Y = 0;
    let ET = 0;
    for (const s of world.stores) {
      if (!s.brands.includes(b.id)) continue;
      for (const m of world.models) if (m.brand === b.id && acc[s.id][m.id]) {
        Y += acc[s.id][m.id].Y;
        ET += acc[s.id][m.id].E * s.traffic;
      }
    }
    groupBrandRate[b.id] = ET > 0 ? Y / ET : 0;
  }
  for (const s of world.stores) {
    affinity[s.id] = {};
    for (const b of s.brands) {
      let Y = 0;
      let E = 0;
      for (const m of world.models) if (m.brand === b && acc[s.id][m.id]) {
        Y += acc[s.id][m.id].Y;
        E += acc[s.id][m.id].E;
      }
      const expected = E * s.traffic * groupBrandRate[b];
      affinity[s.id][b] = (Y + AFFINITY_PSEUDO) / (expected + AFFINITY_PSEUDO);
    }
  }

  // Group rate per model and empirical Bayes prior strength.
  const groupRate: Record<string, number> = {};
  const priorStrength: Record<string, number> = {};
  const rates: Record<string, Record<string, RateEstimate>> = {};
  for (const s of world.stores) rates[s.id] = {};
  for (const m of world.models) {
    const stores = world.stores.filter((s) => acc[s.id][m.id] && acc[s.id][m.id].E > 0);
    let Y = 0;
    let X = 0;
    for (const s of stores) {
      Y += acc[s.id][m.id].Y;
      X += acc[s.id][m.id].E * s.traffic * affinity[s.id][m.brand];
    }
    const mu = X > 0 ? Y / X : 0;
    groupRate[m.id] = mu;
    // Method of moments on ratios observed / prior expected.
    const ratios: number[] = [];
    const noise: number[] = [];
    for (const s of stores) {
      const a = acc[s.id][m.id];
      const prior = mu * s.traffic * affinity[s.id][m.brand];
      if (prior <= 0) continue;
      ratios.push(a.Y / (a.E * prior));
      noise.push(a.W2E / (a.E * a.E * prior));
    }
    const mean = ratios.reduce((x, y) => x + y, 0) / Math.max(ratios.length, 1);
    const varObs = ratios.reduce((x, r) => x + (r - mean) ** 2, 0) / Math.max(ratios.length - 1, 1);
    const varNoise = noise.reduce((x, y) => x + y, 0) / Math.max(noise.length, 1);
    const varTheta = Math.max(varObs - varNoise, 0.0025);
    const strength = Math.min(400, Math.max(2, 1 / varTheta));
    priorStrength[m.id] = strength;
    for (const s of world.stores) {
      const a = acc[s.id][m.id];
      if (!a) continue;
      const prior = mu * s.traffic * affinity[s.id][m.brand];
      const shape = strength + a.Y;
      const rate = strength / Math.max(prior, 1e-6) + a.E;
      rates[s.id][m.id] = {
        mean: shape / rate,
        q10: gammaQuantile(shape, rate, -Z80),
        q90: gammaQuantile(shape, rate, Z80),
        raw: a.E > 0 ? a.Y / a.E : null,
        priorMean: prior,
        priorStrength: strength,
        shape,
        rate,
        monthsOfHistory: a.months,
      };
    }
  }

  // Trim and color shares, Dirichlet smoothed toward group shares.
  const sumVec = (vs: number[][]) => vs.reduce((a, v) => a.map((x, i) => x + v[i]));
  const allTrim = sumVec(world.stores.flatMap((s) => Object.values(world.trimCounts[s.id])));
  const allColor = sumVec(world.stores.flatMap((s) => Object.values(world.colorCounts[s.id])));
  const norm = (v: number[]) => {
    const t = v.reduce((a, b) => a + b, 0);
    return v.map((x) => x / t);
  };
  const groupTrim = norm(allTrim);
  const groupColor = norm(allColor);
  const trimShare: Record<string, number[]> = {};
  const colorShare: Record<string, number[]> = {};
  for (const s of world.stores) {
    const t = sumVec(Object.values(world.trimCounts[s.id]));
    const c = sumVec(Object.values(world.colorCounts[s.id]));
    const nt = t.reduce((a, b) => a + b, 0);
    const nc = c.reduce((a, b) => a + b, 0);
    trimShare[s.id] = t.map((x, i) => (x + TRIM_COLOR_PRIOR * groupTrim[i]) / (nt + TRIM_COLOR_PRIOR));
    colorShare[s.id] = c.map((x, i) => (x + TRIM_COLOR_PRIOR * groupColor[i]) / (nc + TRIM_COLOR_PRIOR));
  }
  void brandOf;
  return { monthsUsed, growth, season, rates, affinity, groupRate, priorStrength, trimShare, colorShare, groupTrim, groupColor };
}

/** Monthly deseasonalized sale rate of one exact configuration at a dealership. */
export function configRate(dm: DemandModel, store: string, model: string, trim: number, color: number, which: "mean" | "q10" | "q90" = "mean"): number {
  const r = dm.rates[store]?.[model];
  if (!r) return 0;
  return r[which] * dm.trimShare[store][trim] * dm.colorShare[store][color];
}

/** Cumulative seasonal exposure in "average days" for each forward day, C[t] = sum of season over days 0..t-1. */
export interface SeasonCurves {
  horizonDays: number;
  cum: Record<string, Float64Array>; // per brand, length maxDays + 1, season x launch trend
  avgAhead: Record<string, number>; // per brand, mean season index over the horizon
  avgAheadTrend: Record<string, number>; // per brand, mean season x trend over the horizon
}

export const MAX_DAYS = 365;

export function buildSeasonCurves(world: World, dm: DemandModel, horizonDays: number): SeasonCurves {
  const months = forwardDayMonths(world.today, MAX_DAYS + 1);
  const cum: Record<string, Float64Array> = {};
  const avgAhead: Record<string, number> = {};
  const avgAheadTrend: Record<string, number> = {};
  for (const b of world.brands) {
    const g = b.seasonGroup;
    const c = new Float64Array(MAX_DAYS + 1);
    let plain = 0;
    for (let t = 1; t <= MAX_DAYS; t++) {
      const sIdx = dm.season[g][months[t - 1]];
      if (t <= horizonDays) plain += sIdx;
      c[t] = c[t - 1] + sIdx * growthFactor(dm, b.id, (t - 0.5) / DAYS_PER_MONTH);
    }
    cum[b.id] = c;
    avgAhead[b.id] = plain / horizonDays;
    avgAheadTrend[b.id] = c[horizonDays] / horizonDays;
  }
  return { horizonDays, cum, avgAhead, avgAheadTrend };
}

/**
 * Survival-based quantities for one unit.
 * dailyRate: deseasonalized sale rate per average day for this unit (already divided by queue position and multiplied by discount response).
 * transit: days with zero chance of sale.
 */
export function survivalAt(curves: SeasonCurves, brand: string, dailyRate: number, transit: number, t: number): number {
  if (t <= transit) return 1;
  const c = curves.cum[brand];
  return Math.exp(-dailyRate * (c[t] - c[transit]));
}

export function probSoldBy(curves: SeasonCurves, brand: string, dailyRate: number, transit: number, t: number): number {
  return 1 - survivalAt(curves, brand, dailyRate, transit, t);
}

/** Expected days held within [0, horizon): sum over days of P(unsold at start of day). */
export function expectedDaysHeld(curves: SeasonCurves, brand: string, dailyRate: number, transit: number, horizon: number): number {
  const c = curves.cum[brand];
  let s = 0;
  const base = c[Math.min(transit, horizon)];
  for (let d = 0; d < horizon; d++) s += d <= transit ? 1 : Math.exp(-dailyRate * (c[d] - base));
  return s;
}

export const monthlyToDaily = (m: number) => m / DAYS_PER_MONTH;
