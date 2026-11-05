/**
 * npm run verify: model, constraint, KPI, story, determinism, dictionary and forbidden-string checks.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { generate } from "./world-gen";
import { SEED } from "../src/config";
import type { PlanAction, Unit, World } from "../src/lib/types";
import { createDemand, runEngine } from "../src/lib/engine";
import { DEFAULT_ASSUMPTIONS, valueUnit } from "../src/lib/economics";
import { evaluateScenario, deltas } from "../src/lib/scenario";
import { computeKpis } from "../src/lib/kpis";
import { buildGroups, explainUnit } from "../src/lib/explain";
import { runBacktest } from "../src/lib/backtest";
import { optimize } from "../src/lib/optimizer";
import { buildContext } from "../src/lib/economics";

const root = join(__dirname, "..");
let failures = 0;
let passes = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passes++;
    console.log(`  PASS  ${name}${detail ? `  (${detail})` : ""}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? `  (${detail})` : ""}`);
  }
}
const close = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const fmt = (x: number) => Math.round(x).toLocaleString("en-US");

console.log("\n1. Determinism");
{
  const h = (o: unknown) => createHash("sha256").update(JSON.stringify(o)).digest("hex");
  const a = generate(SEED);
  const b = generate(SEED);
  const ha = h(a);
  const hb = h(b);
  check("same seed gives identical JSON", ha === hb, ha.slice(0, 16));
  const disk = h({ world: JSON.parse(readFileSync(join(root, "src/data/world.json"), "utf8")), inventory: JSON.parse(readFileSync(join(root, "src/data/inventory.json"), "utf8")) });
  check("committed data matches generator output", disk === ha);
}

const world = JSON.parse(readFileSync(join(root, "src/data/world.json"), "utf8")) as World;
const units = JSON.parse(readFileSync(join(root, "src/data/inventory.json"), "utf8")) as Unit[];
const dm = createDemand(world);
const engine = runEngine(world, units, dm, DEFAULT_ASSUMPTIONS);
const { ctx, result } = engine;
const stores = Object.fromEntries(world.stores.map((s) => [s.id, s]));
const unitById = new Map(units.map((u) => [u.id, u]));

console.log("\n2. Synthetic world shape");
{
  const over90 = units.filter((u) => u.age > 90).length / units.length;
  check("inventory size 900 to 1,100", units.length >= 900 && units.length <= 1100, `${units.length} units`);
  check("15 to 20 percent over 90 days", over90 >= 0.15 && over90 <= 0.2, `${(over90 * 100).toFixed(1)}%`);
  check("every unit sits at a dealership holding its brand", units.every((u) => stores[u.store].brands.includes(u.brand)));
}

console.log("\n3. Constraints");
{
  const transfers = result.actions.filter((a) => a.type === "transfer");
  check("same-brand franchise rule on every transfer", transfers.every((a) => {
    const u = unitById.get(a.unitId)!;
    return stores[a.from].brands.includes(u.brand) && stores[a.to!].brands.includes(u.brand) && a.from === u.store;
  }), `${transfers.length} transfers`);
  check("weekly transfer capacity", transfers.length <= DEFAULT_ASSUMPTIONS.weeklyCapacity, `${transfers.length} of ${DEFAULT_ASSUMPTIONS.weeklyCapacity}`);
  const inbound: Record<string, number> = {};
  transfers.forEach((a) => (inbound[a.to!] = (inbound[a.to!] ?? 0) + 1));
  check("inbound lot capacity per dealership", Object.entries(inbound).every(([s, n]) => n <= stores[s].inboundCap), JSON.stringify(inbound));
  const after = new Map<string, number>();
  const before = new Map<string, number>();
  for (const u of units) before.set(`${u.store}|${u.model}`, (before.get(`${u.store}|${u.model}`) ?? 0) + 1);
  for (const [k, v] of before) after.set(k, v);
  for (const a of transfers) {
    const u = unitById.get(a.unitId)!;
    after.set(`${a.from}|${u.model}`, after.get(`${a.from}|${u.model}`)! - 1);
  }
  check("minimum display stock (no dealership loses its last unit of a model)", [...before.keys()].every((k) => after.get(k)! >= 1));
  const discounts = result.actions.filter((a) => a.type === "discount");
  check("max discount respected", discounts.every((a) => (a.discount ?? 0) <= DEFAULT_ASSUMPTIONS.maxDiscount + 1e-9), `${discounts.length} price actions`);
  check("one action per unit at most", new Set(result.actions.map((a) => a.unitId)).size === result.actions.length);
  check("every action clears the minimum improvement threshold", result.actions.every((a) => a.improvement >= DEFAULT_ASSUMPTIONS.minImprovement - 1e-6));
  // Tight settings still respected.
  const tight = { ...DEFAULT_ASSUMPTIONS, weeklyCapacity: 12, maxDiscount: 0.03 };
  const r2 = optimize(buildContext(world, dm, tight), units);
  check("constraints hold under tighter assumptions", r2.actions.filter((a) => a.type === "transfer").length <= 12 && r2.actions.every((a) => (a.discount ?? 0) <= 0.03 + 1e-9));
}

console.log("\n4. KPI consistency");
{
  const base = evaluateScenario(ctx, units, []);
  const plan = evaluateScenario(ctx, units, result.actions);
  const k0 = computeKpis(ctx, units, base.totals, plan.totals, []);
  const sumUnits = world.stores.reduce((a, s) => a + k0.stores.find((x) => x.store === s.id)!.units, 0);
  const sumValue = units.reduce((a, u) => a + u.cost, 0);
  const sumValueStores = k0.stores.reduce((a, s) => a + s.value, 0);
  check("units KPI equals unit count and store sums", k0.units === units.length && sumUnits === units.length, `${k0.units}`);
  check("inventory value equals sum of unit costs and store sums", close(k0.inventoryValue, sumValue) && close(sumValueStores, sumValue), fmt(sumValue));
  check("avg days equals mean unit age", close(k0.avgDays, units.reduce((a, u) => a + u.age, 0) / units.length), k0.avgDays.toFixed(1));
  check("over-90 count equals units over 90 and store bucket sums", k0.over90 === units.filter((u) => u.age > 90).length && k0.stores.reduce((a, s) => a + s.buckets[3], 0) === k0.over90, `${k0.over90}`);
  check("monthly plan piso equals sum of unit costs x rate / 12", close(k0.monthlyFloorplan, (sumValue * DEFAULT_ASSUMPTIONS.floorplanRate) / 12));
  check("optimizer accumulated improvement equals full scenario EV gain", close(result.accumulated, result.summary.evGain, 1e-6), `${fmt(result.accumulated)} vs ${fmt(result.summary.evGain)}`);
  check("no approvals: approved deltas are zero", k0.approvedSavings === 0 && k0.approvedCapital === 0 && k0.monthlyFloorplanApproved === k0.monthlyFloorplan);
  const kAll = computeKpis(ctx, units, base.totals, plan.totals, result.actions);
  check("approve all: savings move by exactly the plan delta", close(kAll.approvedSavings, result.summary.monthlyFloorplanSavings) && close(kAll.monthlyFloorplan - kAll.monthlyFloorplanApproved, result.summary.monthlyFloorplanSavings), fmt(result.summary.monthlyFloorplanSavings) + " MXN/month");
  check("approve all: capital freed moves by exactly the plan delta", close(kAll.approvedCapital, result.summary.capitalFreed90), fmt(result.summary.capitalFreed90));
  const subset: PlanAction[] = result.actions.filter((_, i) => i % 3 === 0);
  const kSub = computeKpis(ctx, units, base.totals, plan.totals, subset);
  const dSub = deltas(base.totals, evaluateScenario(ctx, units, subset).totals);
  check("approve a subset: KPIs move by exactly that subset's computed deltas", close(kSub.approvedSavings, dSub.monthlyFloorplanSavings) && close(kSub.approvedCapital, dSub.capitalFreed90), `${subset.length} actions`);
  // Panorama map arcs come from the same actions.
  const routeUnits = result.summary.routes.reduce((a, r) => a + r.unitIds.length, 0);
  check("route totals equal transfer count", routeUnits === result.summary.transfers);
}

console.log("\n5. Planted stories");
{
  const story = (id: number) => units.filter((u) => u.storyId === id);
  const actionOf = (u: Unit) => result.actions.find((a) => a.unitId === u.id);
  const groups = buildGroups(units);

  const s1 = story(1)[0];
  const a1 = actionOf(s1);
  const e1 = explainUnit(ctx, units, s1, a1, groups);
  check("story 1: Nordhaus N5 in Toluca goes to Polanco", a1?.type === "transfer" && a1.to === "POL", `speed x${e1.speedRatio.toFixed(1)}, +${fmt(a1?.improvement ?? 0)}`);
  check("story 1: sells about 3x faster in Polanco", e1.speedRatio > 2.4 && e1.speedRatio < 3.8, e1.speedRatio.toFixed(2));

  const s2 = story(2);
  const a2 = s2.map(actionOf);
  const dests = new Set(a2.filter((a) => a?.type === "transfer").map((a) => a!.to));
  check("story 2: all five KX5 base white units leave Polanco", a2.every((a) => a?.type === "transfer"), [...a2].map((a) => a?.to ?? "keep").join(","));
  check("story 2: spread over at least 2 destinations", dests.size >= 2, [...dests].join(","));
  check("story 2: destinations are value and regional dealerships", [...dests].every((d) => ["ECA", "PAC", "PUE", "TOL", "SAT", "LEO"].includes(d!)));

  const s3 = story(3)[0];
  const bt = runBacktest(world);
  const coy = bt.pooling.Z7.find((r) => r.store === "COY")!;
  check("story 3: Zhenlong Z7 at Coyoacán has few months of history", dm.rates.COY.Z7.monthsOfHistory <= 6 && !!s3, `${dm.rates.COY.Z7.monthsOfHistory} months live, ${coy.months} in backtest`);
  check("story 3: pooled estimate closer to held-out actual than raw", Math.abs(coy.pooled - coy.actual) < Math.abs((coy.raw ?? 0) - coy.actual), `raw ${coy.raw?.toFixed(1)}, pooled ${coy.pooled.toFixed(1)}, actual ${coy.actual.toFixed(1)}`);

  const s4 = story(4)[0];
  const a4 = actionOf(s4);
  const e4 = explainUnit(ctx, units, s4, a4, groups);
  check("story 4: Vantor Summit in León gets a discount, not a transfer", a4?.type === "discount", `${((a4?.discount ?? 0) * 100).toFixed(0)}%`);
  check("story 4: discount is about 4 percent", !!a4 && (a4.discount ?? 0) >= 0.03 && (a4.discount ?? 0) <= 0.05);
  check("story 4: no transfer pays off (transfer cost exceeds the gain)", (e4.bestTransfer?.gain ?? 0) < 0, `best transfer ${e4.bestTransfer?.store} ${fmt(e4.bestTransfer?.gain ?? 0)}, cost ${fmt(e4.bestTransfer?.value.transferCost ?? 0)}`);

  const s5 = story(5)[0];
  const e5 = explainUnit(ctx, units, s5, actionOf(s5), groups);
  check("story 5: Kaido KX3 in Satélite is kept", !actionOf(s5), `best alternative ${fmt(Math.max(e5.bestTransfer?.gain ?? -1e9, e5.bestDiscount?.gain ?? -1e9))}`);
  check("story 5: season ahead raises demand", e5.seasonLift > 0.05, `+${(e5.seasonLift * 100).toFixed(0)}%`);

  const s6 = story(6)[0];
  const a6 = actionOf(s6);
  const e6 = explainUnit(ctx, units, s6, a6, groups);
  check("story 6: Solenne Grand in Querétaro goes to Santa Fe", a6?.type === "transfer" && a6.to === "SFE");
  check("story 6: every option loses money and Santa Fe loses least", e6.options.every((o) => o.value.ev < 0) && e6.kind === "leastLoss", `SFE ${fmt(e6.chosen.value.ev)}, keep ${fmt(e6.keep.value.ev)}`);
}

console.log("\n6. Model sanity");
{
  const bt = runBacktest(world);
  console.log(`        backtest WAPE model ${(bt.wape.model * 100).toFixed(1)}%, naive ${(bt.wape.naive * 100).toFixed(1)}%`);
  check("backtest runs on held-out months 22 to 24", bt.testIdx.join(",") === "21,22,23");
  check("probabilities are within [0, 1]", Object.values(evaluateScenario(ctx, units, []).values).every((v) => v.p30 >= 0 && v.p90 <= 1 && v.p30 <= v.p60 && v.p60 <= v.p90));
  const u = units[0];
  check("discount raises sale probability", valueUnit(ctx, u, { store: u.store, discount: 0.05 }, 1).p90 >= valueUnit(ctx, u, { store: u.store, discount: 0 }, 1).p90);
}

console.log("\n7. Performance");
{
  const times: number[] = [];
  for (let i = 0; i < 5; i++) times.push(optimize(ctx, units).runtimeMs);
  const best = Math.min(...times);
  const median = [...times].sort((a, b) => a - b)[2];
  check("optimizer under 300 ms on full inventory", median < 300, `median ${median.toFixed(0)} ms, best ${best.toFixed(0)} ms, ${units.length} units`);
}

console.log("\n8. Dictionaries and copy");
{
  const es = JSON.parse(readFileSync(join(root, "src/i18n/es.json"), "utf8")) as Record<string, string>;
  const en = JSON.parse(readFileSync(join(root, "src/i18n/en.json"), "utf8")) as Record<string, string>;
  const ke = Object.keys(es).sort();
  const kn = Object.keys(en).sort();
  const missingEn = ke.filter((k) => !(k in en));
  const missingEs = kn.filter((k) => !(k in es));
  check("both dictionaries have identical keys", missingEn.length === 0 && missingEs.length === 0, `${ke.length} keys${missingEn.length ? " missing en: " + missingEn.slice(0, 5) : ""}${missingEs.length ? " missing es: " + missingEs.slice(0, 5) : ""}`);
  const empty = [...Object.entries(es), ...Object.entries(en)].filter(([, v]) => typeof v !== "string" || v.trim() === "");
  check("no empty dictionary values", empty.length === 0, empty.map(([k]) => k).slice(0, 5).join(","));
  const bad = [...Object.entries(es).map(([k, v]) => ["es", k, v]), ...Object.entries(en).map(([k, v]) => ["en", k, v])].filter(([, , v]) => /[—–;]/.test(v));
  check("no em dashes, en dashes or semicolons in dictionary values", bad.length === 0, bad.map(([l, k]) => `${l}.${k}`).slice(0, 5).join(","));
  const hype = /\b(revolutionary|magic|unlock|supercharge|revolucionari[oa]|mágic[oa]|potencia al máximo)\b/i;
  const hyped = [...Object.values(es), ...Object.values(en)].filter((v) => hype.test(v));
  check("no hype words in copy", hyped.length === 0);
}

console.log("\n9. Forbidden strings");
{
  const forbidden = /picacho/i;
  const hits: string[] = [];
  const scan = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (["node_modules", ".git", ".next", "screenshots"].includes(f)) continue;
        scan(p);
      } else if ([".ts", ".tsx", ".js", ".mjs", ".json", ".html", ".css", ".md", ".txt"].includes(extname(f))) {
        if (forbidden.test(readFileSync(p, "utf8"))) hits.push(p.replace(root + "/", ""));
      }
    }
  };
  scan(join(root, "src"));
  scan(join(root, "scripts"));
  scan(join(root, "out"));
  scan(join(root, "public"));
  const self = "scripts/verify.ts";
  const real = hits.filter((h) => h !== self);
  check("forbidden name absent from source and build output", real.length === 0, real.join(", ") || (existsSync(join(root, "out")) ? "src, scripts, out scanned" : "src, scripts scanned (no build yet)"));
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
