/**
 * Evaluate a full scenario: apply a set of actions, rebuild queues, value every unit.
 * Used by the optimizer summary, the Panorama KPIs and verification, so numbers always agree.
 */
import type { PlanAction, Unit } from "./types";
import { valueUnit, type EconContext, type UnitState, type UnitValue } from "./economics";

export const configKey = (store: string, u: Unit) => `${store}|${u.model}|${u.trim}|${u.color}`;

/** Oldest first, deterministic tie-break on id. */
export const queueOrder = (a: Unit, b: Unit) => b.age - a.age || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export interface ScenarioResult {
  values: Record<string, UnitValue>;
  states: Record<string, UnitState>;
  totals: ScenarioTotals;
}

export interface ScenarioTotals {
  ev: number;
  floorplan90: number; // expected plan piso cost over the 90-day horizon
  capitalSold90: number; // expected cost value of units sold within 90 days
  expectedSold90: number;
  transferCost: number;
  discountCost: number;
}

export function statesFor(units: Unit[], actions: PlanAction[]): Record<string, UnitState> {
  const states: Record<string, UnitState> = {};
  for (const u of units) states[u.id] = { store: u.store, discount: 0 };
  for (const a of actions) {
    const s = states[a.unitId];
    if (!s) continue;
    if (a.type === "transfer" && a.to) s.store = a.to;
    if (a.type === "discount" && a.discount) s.discount = a.discount;
  }
  return states;
}

export function evaluateScenario(ctx: EconContext, units: Unit[], actions: PlanAction[]): ScenarioResult {
  const states = statesFor(units, actions);
  const groups = new Map<string, Unit[]>();
  for (const u of units) {
    const k = configKey(states[u.id].store, u);
    const arr = groups.get(k);
    if (arr) arr.push(u);
    else groups.set(k, [u]);
  }
  const values: Record<string, UnitValue> = {};
  const totals: ScenarioTotals = { ev: 0, floorplan90: 0, capitalSold90: 0, expectedSold90: 0, transferCost: 0, discountCost: 0 };
  for (const arr of groups.values()) {
    arr.sort(queueOrder);
    arr.forEach((u, i) => {
      const v = valueUnit(ctx, u, states[u.id], i + 1);
      values[u.id] = v;
      totals.ev += v.ev;
      totals.floorplan90 += v.floorplan;
      totals.capitalSold90 += v.p90 * u.cost;
      totals.expectedSold90 += v.p90;
      totals.transferCost += v.transferCost;
      totals.discountCost += v.discountCost;
    });
  }
  return { values, states, totals };
}

export interface KpiDeltas {
  monthlyFloorplanSavings: number;
  capitalFreed90: number;
  evGain: number;
}

export function deltas(base: ScenarioTotals, withPlan: ScenarioTotals): KpiDeltas {
  return {
    monthlyFloorplanSavings: (base.floorplan90 - withPlan.floorplan90) / 3,
    capitalFreed90: withPlan.capitalSold90 - base.capitalSold90,
    evGain: withPlan.ev - base.ev,
  };
}
