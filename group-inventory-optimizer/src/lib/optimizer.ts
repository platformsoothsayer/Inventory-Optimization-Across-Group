/**
 * Capacity-constrained greedy optimizer with lazy re-scoring, then one local improvement pass.
 * Constraints: weekly transfer capacity, inbound lot capacity per dealership, minimum display stock,
 * same-brand franchise rule, maximum discount.
 */
import type { PlanAction, Unit } from "./types";
import { DISCOUNT_STEP, expectedDaysToSell, valueUnit, type EconContext } from "./economics";
import { configKey, deltas, evaluateScenario, queueOrder, type KpiDeltas, type ScenarioTotals } from "./scenario";

export interface Route {
  from: string;
  to: string;
  unitIds: string[];
  km: number;
  loads: number;
  cost: number;
  value: number;
}

export interface PlanSummary extends KpiDeltas {
  transfers: number;
  priceActions: number;
  daysReduction: number; // average reduction in expected days to sell across actioned units
  transferCost: number;
  routes: Route[];
}

export interface Binding {
  weeklyUsed: number;
  weeklyCap: number;
  inboundUsed: Record<string, number>;
  inboundCap: Record<string, number>;
  fullStores: string[];
  displayBlocked: number;
  atMaxDiscount: number;
}

export interface OptimizerResult {
  actions: PlanAction[];
  summary: PlanSummary;
  binding: Binding;
  base: ScenarioTotals;
  plan: ScenarioTotals;
  accumulated: number; // sum of accepted marginal improvements
  runtimeMs: number;
}

export const CARRIER_SIZE = 8;

interface Candidate {
  unitId: string;
  type: "transfer" | "discount";
  to?: string;
  discount?: number;
  score: number;
  v1: number;
  v2: number;
  tie: string;
}

class MaxHeap {
  private a: Candidate[] = [];
  get size() {
    return this.a.length;
  }
  private better(x: Candidate, y: Candidate) {
    return x.score > y.score || (x.score === y.score && x.tie < y.tie);
  }
  push(c: Candidate) {
    const a = this.a;
    a.push(c);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.better(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): Candidate | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.better(a[l], a[m])) m = l;
        if (r < a.length && this.better(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function optimize(ctx: EconContext, units: Unit[]): OptimizerResult {
  const t0 = now();
  const a = ctx.a;
  const unitById = new Map(units.map((u) => [u.id, u]));
  const loc = new Map<string, string>();
  const disc = new Map<string, number>();
  const acted = new Set<string>();
  const groups = new Map<string, Unit[]>();
  const version = new Map<string, number>();
  const gval = new Map<string, number>();
  const modelCount = new Map<string, number>();
  const inbound: Record<string, number> = {};
  for (const s of ctx.world.stores) inbound[s.id] = 0;

  for (const u of units) {
    loc.set(u.id, u.store);
    disc.set(u.id, 0);
    const k = configKey(u.store, u);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(u);
    const mk = `${u.store}|${u.model}`;
    modelCount.set(mk, (modelCount.get(mk) ?? 0) + 1);
  }
  for (const arr of groups.values()) arr.sort(queueOrder);

  const storeOfKey = (k: string) => k.slice(0, k.indexOf("|"));
  const valueOf = (k: string, members: Unit[]) => {
    const store = storeOfKey(k);
    let s = 0;
    for (let i = 0; i < members.length; i++) s += valueUnit(ctx, members[i], { store, discount: disc.get(members[i].id)! }, i + 1).ev;
    return s;
  };
  const groupValue = (k: string) => {
    let v = gval.get(k);
    if (v === undefined) {
      v = valueOf(k, groups.get(k) ?? []);
      gval.set(k, v);
    }
    return v;
  };
  const ver = (k: string) => version.get(k) ?? 0;
  const bump = (k: string) => {
    version.set(k, ver(k) + 1);
    gval.delete(k);
  };
  const withUnit = (k: string, u: Unit) => [...(groups.get(k) ?? []), u].sort(queueOrder);
  const withoutUnit = (k: string, u: Unit) => (groups.get(k) ?? []).filter((x) => x.id !== u.id);

  /** Change in total value from moving unit u from its current planned store to `to`. */
  const transferDelta = (u: Unit, to: string) => {
    const k1 = configKey(loc.get(u.id)!, u);
    const k2 = configKey(to, u);
    const before = groupValue(k1) + groupValue(k2);
    const after = valueOf(k1, withoutUnit(k1, u)) + valueOf(k2, withUnit(k2, u));
    return after - before;
  };

  const bestDiscount = (u: Unit) => {
    const k = configKey(loc.get(u.id)!, u);
    const members = groups.get(k)!;
    const pos = members.findIndex((x) => x.id === u.id) + 1;
    const store = loc.get(u.id)!;
    const base = valueUnit(ctx, u, { store, discount: 0 }, pos).ev;
    let best = 0;
    let bestD = 0;
    const steps = Math.round(a.maxDiscount / DISCOUNT_STEP + 1e-9);
    for (let i = 1; i <= steps; i++) {
      const d = Math.round(i * DISCOUNT_STEP * 1000) / 1000;
      const gain = valueUnit(ctx, u, { store, discount: d }, pos).ev - base;
      if (gain > best + 1e-9) {
        best = gain;
        bestD = d;
      }
    }
    return { gain: best, discount: bestD };
  };

  const eligible = (u: Unit) =>
    ctx.world.stores.filter((s) => s.id !== u.store && s.brands.includes(u.brand) && ctx.stores[u.store].brands.includes(u.brand));

  const heap = new MaxHeap();
  const score = (u: Unit, type: "transfer" | "discount", to?: string): Candidate | null => {
    const k1 = configKey(loc.get(u.id)!, u);
    if (type === "transfer") {
      const s = transferDelta(u, to!);
      if (s < a.minImprovement) return null;
      return { unitId: u.id, type, to, score: s, v1: ver(k1), v2: ver(configKey(to!, u)), tie: `${u.id}|t|${to}` };
    }
    const b = bestDiscount(u);
    if (b.gain < a.minImprovement) return null;
    return { unitId: u.id, type, discount: b.discount, score: b.gain, v1: ver(k1), v2: 0, tie: `${u.id}|d` };
  };

  for (const u of units) {
    for (const s of eligible(u)) {
      const c = score(u, "transfer", s.id);
      if (c) heap.push(c);
    }
    const d = score(u, "discount");
    if (d) heap.push(d);
  }

  const actions: PlanAction[] = [];
  let transfers = 0;
  let accumulated = 0;
  const displayBlocked = new Set<string>();

  while (heap.size) {
    const c = heap.pop()!;
    if (acted.has(c.unitId)) continue;
    const u = unitById.get(c.unitId)!;
    const k1 = configKey(loc.get(u.id)!, u);
    const stale = c.type === "transfer" ? c.v1 !== ver(k1) || c.v2 !== ver(configKey(c.to!, u)) : c.v1 !== ver(k1);
    if (stale) {
      const r = score(u, c.type, c.to);
      if (r) heap.push(r);
      continue;
    }
    if (c.type === "transfer") {
      const to = c.to!;
      if (transfers >= a.weeklyCapacity) continue;
      if (inbound[to] >= ctx.stores[to].inboundCap) continue;
      if ((modelCount.get(`${u.store}|${u.model}`) ?? 0) < 2) {
        displayBlocked.add(u.id);
        continue;
      }
      const kTo = configKey(to, u);
      groups.set(k1, withoutUnit(k1, u));
      groups.set(kTo, withUnit(kTo, u));
      bump(k1);
      bump(kTo);
      loc.set(u.id, to);
      modelCount.set(`${u.store}|${u.model}`, modelCount.get(`${u.store}|${u.model}`)! - 1);
      modelCount.set(`${to}|${u.model}`, (modelCount.get(`${to}|${u.model}`) ?? 0) + 1);
      inbound[to]++;
      transfers++;
      acted.add(u.id);
      accumulated += c.score;
      actions.push({ id: `${u.id}:T:${to}`, unitId: u.id, type: "transfer", from: u.store, to, improvement: c.score });
    } else {
      disc.set(u.id, c.discount!);
      gval.delete(k1);
      acted.add(u.id);
      accumulated += c.score;
      actions.push({ id: `${u.id}:D:${Math.round(c.discount! * 100)}`, unitId: u.id, type: "discount", from: u.store, discount: c.discount, improvement: c.score });
    }
  }

  // Local improvement: try each accepted transfer at its other destinations.
  for (const act of actions) {
    if (act.type !== "transfer") continue;
    const u = unitById.get(act.unitId)!;
    let bestGain = 1e-6;
    let bestTo: string | null = null;
    for (const s of eligible(u)) {
      if (s.id === act.to) continue;
      if (inbound[s.id] >= s.inboundCap) continue;
      const g = transferDelta(u, s.id);
      if (g > bestGain || (g === bestGain && bestTo !== null && s.id < bestTo)) {
        bestGain = g;
        bestTo = s.id;
      }
    }
    if (bestTo) {
      const kOld = configKey(act.to!, u);
      const kNew = configKey(bestTo, u);
      groups.set(kOld, withoutUnit(kOld, u));
      groups.set(kNew, withUnit(kNew, u));
      bump(kOld);
      bump(kNew);
      loc.set(u.id, bestTo);
      modelCount.set(`${act.to}|${u.model}`, modelCount.get(`${act.to}|${u.model}`)! - 1);
      modelCount.set(`${bestTo}|${u.model}`, (modelCount.get(`${bestTo}|${u.model}`) ?? 0) + 1);
      inbound[act.to!]--;
      inbound[bestTo]++;
      act.to = bestTo;
      act.id = `${u.id}:T:${bestTo}`;
      act.improvement += bestGain;
      accumulated += bestGain;
    }
  }

  actions.sort((x, y) => y.improvement - x.improvement || (x.id < y.id ? -1 : 1));
  const runtimeMs = now() - t0;
  const result = summarize(ctx, units, actions);
  const atMaxDiscount = actions.filter((x) => x.type === "discount" && Math.abs((x.discount ?? 0) - a.maxDiscount) < 1e-9).length;
  const inboundCap = Object.fromEntries(ctx.world.stores.map((s) => [s.id, s.inboundCap]));
  return {
    actions,
    summary: result.summary,
    base: result.base,
    plan: result.plan,
    accumulated,
    runtimeMs,
    binding: {
      weeklyUsed: transfers,
      weeklyCap: a.weeklyCapacity,
      inboundUsed: inbound,
      inboundCap,
      fullStores: ctx.world.stores.filter((s) => inbound[s.id] >= s.inboundCap).map((s) => s.id),
      displayBlocked: displayBlocked.size,
      atMaxDiscount,
    },
  };
}

export function summarize(ctx: EconContext, units: Unit[], actions: PlanAction[]) {
  const base = evaluateScenario(ctx, units, []);
  const plan = evaluateScenario(ctx, units, actions);
  const d = deltas(base.totals, plan.totals);
  const unitById = new Map(units.map((u) => [u.id, u]));
  let daysSum = 0;
  for (const act of actions) {
    const u = unitById.get(act.unitId)!;
    const b = base.values[u.id];
    const p = plan.values[u.id];
    daysSum += expectedDaysToSell(ctx, u, b.store, b.queuePos, 0) - expectedDaysToSell(ctx, u, p.store, p.queuePos, p.discount);
  }
  const routeMap = new Map<string, Route>();
  for (const act of actions) {
    if (act.type !== "transfer") continue;
    const key = `${act.from}>${act.to}`;
    let r = routeMap.get(key);
    if (!r) {
      r = { from: act.from, to: act.to!, unitIds: [], km: ctx.km[act.from][act.to!], loads: 0, cost: 0, value: 0 };
      routeMap.set(key, r);
    }
    r.unitIds.push(act.unitId);
    r.cost += plan.values[act.unitId].transferCost;
    r.value += act.improvement;
  }
  const routes = [...routeMap.values()];
  routes.forEach((r) => (r.loads = Math.ceil(r.unitIds.length / CARRIER_SIZE)));
  routes.sort((x, y) => y.value - x.value || (x.from + x.to < y.from + y.to ? -1 : 1));
  return {
    base: base.totals,
    plan: plan.totals,
    summary: {
      ...d,
      transfers: actions.filter((x) => x.type === "transfer").length,
      priceActions: actions.filter((x) => x.type === "discount").length,
      daysReduction: actions.length ? daysSum / actions.length : 0,
      transferCost: plan.totals.transferCost,
      routes,
    } as PlanSummary,
  };
}
