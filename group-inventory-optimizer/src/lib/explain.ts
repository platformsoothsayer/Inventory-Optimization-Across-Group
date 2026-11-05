/**
 * Explanations built only from computed values. Returns structured data; the UI fills
 * bilingual templates from the dictionaries. No invented facts.
 */
import type { PlanAction, Unit } from "./types";
import { DISCOUNT_STEP, valueUnit, expectedDaysToSell, saleCurve, transferCost, type EconContext, type UnitValue } from "./economics";
import { configKey, queueOrder } from "./scenario";

export type DriverKey = "modelDemand" | "configFit" | "competingStock" | "seasonAhead";

export interface Driver {
  key: DriverKey;
  factor: number; // multiplicative effect on the sale rate of the recommended option vs the reference
  from: number;
  to: number;
}

export interface UnitOption {
  kind: "keep" | "transfer" | "discount";
  store: string;
  discount: number;
  queuePos: number;
  value: UnitValue;
  gain: number; // unit-level EV gain vs keep
  daysToSell: number;
}

export interface Waterfall {
  floorplanAvoided: number;
  agingAvoided: number;
  marginEffect: number;
  transferCost: number;
  discountCost: number;
  otherUnits: number;
  net: number;
}

export type ExplanationKind = "transfer" | "discount" | "keep" | "leastLoss";

export interface Explanation {
  kind: ExplanationKind;
  unit: Unit;
  keep: UnitOption;
  chosen: UnitOption;
  options: UnitOption[];
  bestTransfer: UnitOption | null;
  bestDiscount: UnitOption | null;
  speedRatio: number; // unit sale rate of chosen option vs keep
  drivers: Driver[]; // top 3 by size
  allDrivers: Driver[];
  waterfall: Waterfall;
  seasonLift: number; // average season index over the horizon minus 1
  demandByStore: { store: string; rate: number; q10: number; q90: number }[];
  curves: { key: string; store: string; discount: number; mean: number[]; lo: number[]; hi: number[] }[];
  improvement: number;
  accumulatedFloorplan: number;
}

/** Queue position a unit would take in a destination group given current groups. */
export function queuePosIn(groups: Map<string, Unit[]>, store: string, u: Unit): number {
  const arr = groups.get(configKey(store, u)) ?? [];
  let pos = 1;
  for (const x of arr) if (x.id !== u.id && queueOrder(x, u) < 0) pos++;
  return pos;
}

export function buildGroups(units: Unit[], storeOf: (u: Unit) => string = (u) => u.store): Map<string, Unit[]> {
  const groups = new Map<string, Unit[]>();
  for (const u of units) {
    const k = configKey(storeOf(u), u);
    const arr = groups.get(k);
    if (arr) arr.push(u);
    else groups.set(k, [u]);
  }
  for (const arr of groups.values()) arr.sort(queueOrder);
  return groups;
}

export function unitOptions(ctx: EconContext, groups: Map<string, Unit[]>, u: Unit): UnitOption[] {
  const out: UnitOption[] = [];
  const pos0 = queuePosIn(groups, u.store, u);
  const keepV = valueUnit(ctx, u, { store: u.store, discount: 0 }, pos0);
  const mk = (kind: UnitOption["kind"], store: string, discount: number, pos: number): UnitOption => {
    const v = valueUnit(ctx, u, { store, discount }, pos);
    return { kind, store, discount, queuePos: pos, value: v, gain: v.ev - keepV.ev, daysToSell: expectedDaysToSell(ctx, u, store, pos, discount) };
  };
  out.push(mk("keep", u.store, 0, pos0));
  for (const s of ctx.world.stores) {
    if (s.id === u.store || !s.brands.includes(u.brand)) continue;
    out.push(mk("transfer", s.id, 0, queuePosIn(groups, s.id, u)));
  }
  const steps = Math.round(ctx.a.maxDiscount / DISCOUNT_STEP + 1e-9);
  for (let i = 1; i <= steps; i++) out.push(mk("discount", u.store, Math.round(i * DISCOUNT_STEP * 1000) / 1000, pos0));
  return out;
}

function driversFor(ctx: EconContext, u: Unit, keep: UnitOption, chosen: UnitOption, reference: "keep" | "average"): Driver[] {
  const dm = ctx.dm;
  const fit = (s: string) => dm.trimShare[s][u.trim] * dm.colorShare[s][u.color];
  const lam = (s: string) => dm.rates[s][u.model].mean;
  const eligible = ctx.world.stores.filter((s) => s.brands.includes(u.brand)).map((s) => s.id);
  const avg = (f: (s: string) => number) => eligible.reduce((a, s) => a + f(s), 0) / eligible.length;
  const season = ctx.curves.avgAheadTrend[u.brand];
  let ds: Driver[];
  if (reference === "keep" && chosen.store !== keep.store) {
    ds = [
      { key: "modelDemand", from: lam(keep.store), to: lam(chosen.store), factor: lam(chosen.store) / lam(keep.store) },
      { key: "configFit", from: fit(keep.store), to: fit(chosen.store), factor: fit(chosen.store) / fit(keep.store) },
      { key: "competingStock", from: keep.queuePos, to: chosen.queuePos, factor: keep.queuePos / chosen.queuePos },
      { key: "seasonAhead", from: 1, to: season, factor: season },
    ];
  } else {
    // Current dealership vs the average eligible dealership.
    ds = [
      { key: "modelDemand", from: avg(lam), to: lam(keep.store), factor: lam(keep.store) / avg(lam) },
      { key: "configFit", from: avg(fit), to: fit(keep.store), factor: fit(keep.store) / avg(fit) },
      { key: "competingStock", from: 1, to: keep.queuePos, factor: 1 / keep.queuePos },
      { key: "seasonAhead", from: 1, to: season, factor: season },
    ];
  }
  return ds;
}

export function explainUnit(ctx: EconContext, units: Unit[], u: Unit, action: PlanAction | undefined, groups?: Map<string, Unit[]>): Explanation {
  const g = groups ?? buildGroups(units);
  const options = unitOptions(ctx, g, u);
  const keep = options[0];
  const transfers = options.filter((o) => o.kind === "transfer").sort((a, b) => b.gain - a.gain);
  const discounts = options.filter((o) => o.kind === "discount").sort((a, b) => b.gain - a.gain);
  let chosen = keep;
  if (action?.type === "transfer") chosen = options.find((o) => o.kind === "transfer" && o.store === action.to) ?? keep;
  if (action?.type === "discount") chosen = options.find((o) => o.kind === "discount" && Math.abs(o.discount - (action.discount ?? 0)) < 1e-9) ?? keep;
  const allNegative = options.every((o) => o.value.ev < 0);
  const kind: ExplanationKind = chosen.kind === "keep" ? "keep" : allNegative && chosen.kind === "transfer" ? "leastLoss" : chosen.kind;
  const allDrivers = driversFor(ctx, u, keep, chosen, chosen.kind === "transfer" ? "keep" : "average");
  // Top 3 by size, leaving out drivers with no visible effect (under 2 percent).
  const drivers = [...allDrivers]
    .filter((d) => Math.abs(d.factor - 1) >= 0.02)
    .sort((a, b) => Math.abs(Math.log(b.factor)) - Math.abs(Math.log(a.factor)))
    .slice(0, 3);
  const unitGain = chosen.value.ev - keep.value.ev;
  const improvement = action ? action.improvement : 0;
  const waterfall: Waterfall = {
    floorplanAvoided: keep.value.floorplan - chosen.value.floorplan,
    agingAvoided: keep.value.penalty - chosen.value.penalty,
    marginEffect: chosen.value.marginValue - keep.value.marginValue,
    transferCost: -chosen.value.transferCost,
    discountCost: -chosen.value.discountCost,
    otherUnits: action ? improvement - unitGain : 0,
    net: action ? improvement : 0,
  };
  const curveOpts: UnitOption[] = [keep, ...transfers.slice(0, 2)];
  if (chosen.kind === "discount" || (discounts[0] && discounts[0].gain > 0)) curveOpts.push(chosen.kind === "discount" ? chosen : discounts[0]);
  const curves = curveOpts.map((o) => ({
    key: o.kind === "keep" ? "keep" : o.kind === "transfer" ? `t:${o.store}` : `d:${o.discount}`,
    store: o.store,
    discount: o.discount,
    mean: saleCurve(ctx, u, o.store, o.queuePos, o.discount, "mean", 120),
    lo: saleCurve(ctx, u, o.store, o.queuePos, o.discount, "q10", 120),
    hi: saleCurve(ctx, u, o.store, o.queuePos, o.discount, "q90", 120),
  }));
  const demandByStore = ctx.world.stores
    .filter((s) => s.brands.includes(u.brand))
    .map((s) => ({ store: s.id, rate: ctx.dm.rates[s.id][u.model].mean, q10: ctx.dm.rates[s.id][u.model].q10, q90: ctx.dm.rates[s.id][u.model].q90 }))
    .sort((a, b) => b.rate - a.rate);
  return {
    kind,
    unit: u,
    keep,
    chosen,
    options,
    bestTransfer: transfers[0] ?? null,
    bestDiscount: discounts[0] ?? null,
    speedRatio: chosen.value.dailyRate / keep.value.dailyRate,
    drivers,
    allDrivers,
    waterfall,
    seasonLift: ctx.curves.avgAheadTrend[u.brand] - 1,
    demandByStore,
    curves,
    improvement,
    accumulatedFloorplan: (u.cost * ctx.a.floorplanRate * u.age) / 365,
  };
}

export { transferCost };
