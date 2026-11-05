/**
 * Honest out-of-sample check. Fit on months 1-21, forecast months 22-24 by dealership and model.
 * Compare with a naive baseline (average of the last 3 fitted months).
 */
import type { World } from "./types";
import { fitDemand, growthFactor, Z80 } from "./demand";
import { calMonthOfIndex, yearOfIndex } from "./calendar";

export const BACKTEST_FIT_MONTHS = 21;

export interface BacktestSeriesPoint {
  idx: number;
  cal: number;
  year: number;
  actual: number;
  model: number | null;
  naive: number | null;
}

export interface PoolingRow {
  store: string;
  months: number; // months of history in the fit window
  raw: number | null; // forecast from the store's own data only
  pooled: number; // forecast from the partially pooled estimate
  lo: number; // 80% predictive interval for the held-out average, pooled
  hi: number;
  actual: number; // held-out deseasonalized monthly average
}

export interface BacktestResult {
  fitMonths: number;
  testIdx: number[];
  wape: { model: number; naive: number };
  byBrand: { brand: string; model: number; naive: number; actual: number }[];
  series: BacktestSeriesPoint[];
  pooling: Record<string, PoolingRow[]>; // new-entrant models
  poolingError: { model: string; raw: number; pooled: number }[]; // mean absolute error vs held-out rate
}

export function runBacktest(world: World): BacktestResult {
  const fit = BACKTEST_FIT_MONTHS;
  const dm = fitDemand(world, fit);
  const testIdx = Array.from({ length: world.months - fit }, (_, i) => fit + i);
  const groupOf = Object.fromEntries(world.brands.map((b) => [b.id, b.seasonGroup]));
  let errM = 0;
  let errN = 0;
  let act = 0;
  const brandAcc: Record<string, { m: number; n: number; a: number }> = {};
  const seriesModel: Record<number, number> = {};
  const seriesNaive: Record<number, number> = {};
  for (const s of world.stores) {
    for (const m of world.models) {
      const ys = world.sales[s.id][m.id];
      if (!ys) continue;
      const start = world.brandStart[s.id][m.brand];
      if (start >= fit) continue; // no history at all in the fit window
      const r = dm.rates[s.id][m.id];
      const last3 = [fit - 3, fit - 2, fit - 1].filter((i) => i >= start).map((i) => ys[i]);
      const naive = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : 0;
      for (const i of testIdx) {
        const f = r.mean * dm.season[groupOf[m.brand]][calMonthOfIndex(world, i)] * growthFactor(dm, m.brand, i - (fit - 1));
        const a = ys[i];
        errM += Math.abs(f - a);
        errN += Math.abs(naive - a);
        act += a;
        const b = (brandAcc[m.brand] ??= { m: 0, n: 0, a: 0 });
        b.m += Math.abs(f - a);
        b.n += Math.abs(naive - a);
        b.a += a;
        seriesModel[i] = (seriesModel[i] ?? 0) + f;
        seriesNaive[i] = (seriesNaive[i] ?? 0) + naive;
      }
    }
  }
  const series: BacktestSeriesPoint[] = [];
  for (let i = 0; i < world.months; i++) {
    let t = 0;
    for (const s of world.stores) for (const m of world.models) if (world.sales[s.id][m.id]) t += world.sales[s.id][m.id][i];
    series.push({
      idx: i,
      cal: calMonthOfIndex(world, i),
      year: yearOfIndex(world, i),
      actual: t,
      model: i >= fit ? seriesModel[i] : i === fit - 1 ? t : null,
      naive: i >= fit ? seriesNaive[i] : i === fit - 1 ? t : null,
    });
  }

  const pooling: Record<string, PoolingRow[]> = {};
  const poolingError: { model: string; raw: number; pooled: number }[] = [];
  for (const m of world.models) {
    const brand = world.brands.find((b) => b.id === m.brand)!;
    if (!brand.launchMonth) continue;
    const rows: PoolingRow[] = [];
    for (const s of world.stores) {
      const ys = world.sales[s.id][m.id];
      if (!ys) continue;
      const r = dm.rates[s.id][m.id];
      const deseason = testIdx.map((i) => ys[i] / dm.season[brand.seasonGroup][calMonthOfIndex(world, i)]);
      const g = testIdx.reduce((a, i) => a + growthFactor(dm, m.brand, i - (fit - 1)), 0) / testIdx.length;
      const center = r.mean * g;
      const sd = Math.sqrt(center / testIdx.length + (r.shape / (r.rate * r.rate)) * g * g);
      rows.push({
        store: s.id,
        months: Math.max(0, fit - world.brandStart[s.id][m.brand]),
        raw: r.raw === null ? null : r.raw * g,
        pooled: center,
        lo: Math.max(0, center - Z80 * sd),
        hi: center + Z80 * sd,
        actual: deseason.reduce((a, b) => a + b, 0) / deseason.length,
      });
    }
    pooling[m.id] = rows;
    const withRaw = rows.filter((x) => x.raw !== null);
    poolingError.push({
      model: m.id,
      raw: withRaw.reduce((a, x) => a + Math.abs((x.raw as number) - x.actual), 0) / withRaw.length,
      pooled: withRaw.reduce((a, x) => a + Math.abs(x.pooled - x.actual), 0) / withRaw.length,
    });
  }

  return {
    fitMonths: fit,
    testIdx,
    wape: { model: errM / act, naive: errN / act },
    byBrand: world.brands.map((b) => ({ brand: b.id, model: brandAcc[b.id].m / brandAcc[b.id].a, naive: brandAcc[b.id].n / brandAcc[b.id].a, actual: brandAcc[b.id].a })),
    series,
    pooling,
    poolingError,
  };
}
