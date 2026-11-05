/**
 * Expected-value economics over a 90-day horizon.
 * EV = P(sold within horizon) x (margin - discount) - expected plan piso - transfer cost - expected aging penalty
 */
import type { Assumptions, Brand, Model, Segment, Store, Unit, World } from "./types";
import {
  buildSeasonCurves,
  configRate,
  expectedDaysHeld,
  monthlyToDaily,
  probSoldBy,
  survivalAt,
  type DemandModel,
  type SeasonCurves,
} from "./demand";
import { roadKm, transitDays } from "./geo";

export const HORIZON_DAYS = 90;
export const AGING_THRESHOLD_DAYS = 180;
/** Expected write-down or extra cost when a unit crosses 180 days unsold, as a share of cost. */
export const AGING_PENALTY_PCT = 0.05;
export const DISCOUNT_STEP = 0.01;

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  floorplanRate: 0.12,
  weeklyCapacity: 40,
  costPerKm: 24,
  fixedTransferCost: 2500,
  maxDiscount: 0.08,
  minImprovement: 3000,
  elasticity: { volume: 19, newEntrant: 19, premium: 12, luxury: 8 },
};

export interface EconContext {
  world: World;
  dm: DemandModel;
  curves: SeasonCurves;
  a: Assumptions;
  stores: Record<string, Store>;
  models: Record<string, Model>;
  brands: Record<string, Brand>;
  km: Record<string, Record<string, number>>;
}

export function buildContext(world: World, dm: DemandModel, a: Assumptions): EconContext {
  const stores = Object.fromEntries(world.stores.map((s) => [s.id, s]));
  const km: Record<string, Record<string, number>> = {};
  for (const x of world.stores) {
    km[x.id] = {};
    for (const y of world.stores) km[x.id][y.id] = x.id === y.id ? 0 : roadKm(x, y);
  }
  return {
    world,
    dm,
    curves: buildSeasonCurves(world, dm, HORIZON_DAYS),
    a,
    stores,
    models: Object.fromEntries(world.models.map((m) => [m.id, m])),
    brands: Object.fromEntries(world.brands.map((b) => [b.id, b])),
    km,
  };
}

export function segmentOf(ctx: EconContext, unit: Unit): Segment {
  return ctx.brands[unit.brand].segment;
}

export function transferCost(ctx: EconContext, from: string, to: string): number {
  if (from === to) return 0;
  return ctx.a.fixedTransferCost + ctx.a.costPerKm * ctx.km[from][to];
}

export function transitFor(ctx: EconContext, from: string, to: string): number {
  return from === to ? 0 : transitDays(ctx.km[from][to]);
}

export function discountMultiplier(ctx: EconContext, unit: Unit, discount: number): number {
  return Math.exp(ctx.a.elasticity[segmentOf(ctx, unit)] * discount);
}

/** Daily deseasonalized sale rate of a unit at a store and queue position. */
export function unitDailyRate(
  ctx: EconContext,
  unit: Unit,
  store: string,
  queuePos: number,
  discount: number,
  which: "mean" | "q10" | "q90" = "mean",
): number {
  const r = configRate(ctx.dm, store, unit.model, unit.trim, unit.color, which);
  return (monthlyToDaily(r) / queuePos) * discountMultiplier(ctx, unit, discount);
}

export interface UnitState {
  store: string; // planned location
  discount: number;
}

export interface UnitValue {
  store: string;
  discount: number;
  queuePos: number;
  dailyRate: number;
  transit: number;
  p30: number;
  p60: number;
  p90: number;
  daysHeld: number;
  floorplan: number;
  transferCost: number;
  penalty: number;
  marginValue: number; // P x margin before discount
  discountCost: number; // P x discount amount
  ev: number;
}

export function valueUnit(ctx: EconContext, unit: Unit, state: UnitState, queuePos: number): UnitValue {
  const g = unit.brand;
  const rate = unitDailyRate(ctx, unit, state.store, queuePos, state.discount);
  const transit = transitFor(ctx, unit.store, state.store);
  const H = HORIZON_DAYS;
  const p30 = probSoldBy(ctx.curves, g, rate, transit, 30);
  const p60 = probSoldBy(ctx.curves, g, rate, transit, 60);
  const p90 = probSoldBy(ctx.curves, g, rate, transit, H);
  const daysHeld = expectedDaysHeld(ctx.curves, g, rate, transit, H);
  const floorplan = (unit.cost * ctx.a.floorplanRate * daysHeld) / 365;
  const tc = transferCost(ctx, unit.store, state.store);
  const t180 = Math.max(0, AGING_THRESHOLD_DAYS - unit.age);
  const penalty = t180 <= H ? AGING_PENALTY_PCT * unit.cost * survivalAt(ctx.curves, g, rate, transit, t180) : 0;
  const margin = unit.msrp - unit.cost;
  const marginValue = p90 * margin;
  const discountCost = p90 * state.discount * unit.msrp;
  const ev = marginValue - discountCost - floorplan - tc - penalty;
  return {
    store: state.store,
    discount: state.discount,
    queuePos,
    dailyRate: rate,
    transit,
    p30,
    p60,
    p90,
    daysHeld,
    floorplan,
    transferCost: tc,
    penalty,
    marginValue,
    discountCost,
    ev,
  };
}

/** Expected days to sell, capped at 365, from the survival curve. */
export function expectedDaysToSell(ctx: EconContext, unit: Unit, store: string, queuePos: number, discount: number, which: "mean" | "q10" | "q90" = "mean"): number {
  const g = unit.brand;
  const rate = unitDailyRate(ctx, unit, store, queuePos, discount, which);
  const transit = transitFor(ctx, unit.store, store);
  return expectedDaysHeld(ctx.curves, g, rate, transit, 365);
}

/** Probability curve P(sold by day t) for t = 0..days. */
export function saleCurve(ctx: EconContext, unit: Unit, store: string, queuePos: number, discount: number, which: "mean" | "q10" | "q90", days: number): number[] {
  const g = unit.brand;
  const rate = unitDailyRate(ctx, unit, store, queuePos, discount, which);
  const transit = transitFor(ctx, unit.store, store);
  const out: number[] = [];
  for (let t = 0; t <= days; t++) out.push(probSoldBy(ctx.curves, g, rate, transit, t));
  return out;
}
