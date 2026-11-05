/**
 * Synthetic world generator. Pure function of the seed.
 * Truth parameters (affinity, tier preferences, lifecycle) live only here.
 * The app sees sales history, catalog and inventory, never the truth.
 */
import { Rng } from "../src/lib/rng";
import { addDays } from "../src/lib/calendar";
import type { Brand, Model, Store, Tier, Unit, World } from "../src/lib/types";
import { HISTORY_MONTHS, HISTORY_START, TODAY } from "../src/config";

export const STORES: Omit<Store, "traffic" | "inboundCap">[] = [
  { id: "POL", name: "Polanco", region: "CDMX", lat: 19.433, lng: -99.195, tier: "premiumUrban", brands: ["SOL", "NOR", "KAI"] },
  { id: "SFE", name: "Santa Fe", region: "CDMX", lat: 19.359, lng: -99.259, tier: "premiumUrban", brands: ["NOR", "VAN", "SOL"] },
  { id: "COY", name: "Coyoacán", region: "CDMX", lat: 19.35, lng: -99.162, tier: "urbanMid", brands: ["KAI", "ZHE", "QIY"] },
  { id: "SAT", name: "Satélite", region: "Edomex", lat: 19.509, lng: -99.234, tier: "suburban", brands: ["KAI", "VAN", "ZHE"] },
  { id: "ECA", name: "Ecatepec", region: "Edomex", lat: 19.601, lng: -99.05, tier: "suburbanValue", brands: ["KAI", "ZHE"] },
  { id: "TOL", name: "Toluca", region: "Edomex", lat: 19.282, lng: -99.656, tier: "regional", brands: ["VAN", "KAI", "NOR"] },
  { id: "PUE", name: "Puebla", region: "Puebla", lat: 19.041, lng: -98.206, tier: "regional", brands: ["KAI", "VAN", "ZHE", "QIY"] },
  { id: "QRO", name: "Querétaro", region: "Querétaro", lat: 20.588, lng: -100.389, tier: "regionalGrowth", brands: ["NOR", "VAN", "QIY", "SOL"] },
  { id: "PAC", name: "Pachuca", region: "Hidalgo", lat: 20.101, lng: -98.759, tier: "regionalValue", brands: ["ZHE", "KAI"] },
  { id: "LEO", name: "León", region: "Guanajuato", lat: 21.122, lng: -101.682, tier: "regional", brands: ["VAN", "QIY", "KAI"] },
];

const TRAFFIC: Record<string, number> = { POL: 1.15, SFE: 1.1, COY: 1.0, SAT: 1.05, ECA: 0.95, TOL: 0.85, PUE: 1.0, QRO: 1.0, PAC: 0.75, LEO: 0.9 };
const INBOUND: Record<string, number> = { POL: 8, SFE: 8, COY: 7, SAT: 8, ECA: 8, TOL: 8, PUE: 9, QRO: 9, PAC: 7, LEO: 8 };

export const BRANDS: Brand[] = [
  { id: "KAI", name: "Kaido", segment: "volume", seasonGroup: "volume", costRatio: 0.9, launchMonth: null },
  { id: "VAN", name: "Vantor", segment: "volume", seasonGroup: "volume", costRatio: 0.88, launchMonth: null },
  { id: "NOR", name: "Nordhaus", segment: "premium", seasonGroup: "premium", costRatio: 0.89, launchMonth: null },
  { id: "SOL", name: "Solenne", segment: "luxury", seasonGroup: "premium", costRatio: 0.88, launchMonth: null },
  { id: "ZHE", name: "Zhenlong", segment: "newEntrant", seasonGroup: "volume", costRatio: 0.91, launchMonth: 16 },
  { id: "QIY", name: "Qiyun", segment: "newEntrant", seasonGroup: "volume", costRatio: 0.92, launchMonth: 19 },
];

export const MODELS: Model[] = [
  { id: "K3", brand: "KAI", name: "K3", body: "sedan", msrpBase: 382000 },
  { id: "KX3", brand: "KAI", name: "KX3", body: "compactSuv", msrpBase: 458000 },
  { id: "KX5", brand: "KAI", name: "KX5", body: "midSuv", msrpBase: 612000 },
  { id: "TERRA", brand: "VAN", name: "Terra", body: "pickup", msrpBase: 662000 },
  { id: "ATLAS", brand: "VAN", name: "Atlas", body: "midSuv", msrpBase: 638000 },
  { id: "SUMMIT", brand: "VAN", name: "Summit", body: "largeSuv", msrpBase: 704000 },
  { id: "N3", brand: "NOR", name: "N3", body: "premiumCompactSuv", msrpBase: 1024000 },
  { id: "N5", brand: "NOR", name: "N5", body: "premiumMidSuv", msrpBase: 1288000 },
  { id: "BERLINA", brand: "SOL", name: "Berlina", body: "luxurySedan", msrpBase: 1846000 },
  { id: "GRAND", brand: "SOL", name: "Grand", body: "luxurySuv", msrpBase: 2148000 },
  { id: "Z5", brand: "ZHE", name: "Z5", body: "compactSuv", msrpBase: 424000 },
  { id: "Z7", brand: "ZHE", name: "Z7", body: "midSuv", msrpBase: 528000 },
  { id: "QHYB", brand: "QIY", name: "Q Hybrid", body: "hybridSuv", msrpBase: 556000 },
  { id: "QE", brand: "QIY", name: "Q e", body: "compactEv", msrpBase: 612000 },
];

export const TRIMS = ["base", "mid", "top"];
export const TRIM_STEPS = [1.0, 1.09, 1.2];
export const COLORS = ["white", "silver", "gray", "black", "red", "blue"];

/** Truth: base monthly sales rate per model at traffic 1 and affinity 1. */
const BASE_RATE: Record<string, number> = {
  K3: 9, KX3: 11, KX5: 8, TERRA: 7, ATLAS: 6, SUMMIT: 3.6, N3: 4.2, N5: 3.2, BERLINA: 1.5, GRAND: 0.8, Z5: 8, Z7: 6, QHYB: 6, QE: 3.5,
};
const RATE_SCALE = 2.0;
/** Truth: model-specific local taste (large SUVs are popular in the Bajío). */
const MODEL_BOOST: Record<string, Record<string, number>> = { LEO: { SUMMIT: 1.1 } };

/** Truth: brand affinity by store. */
const AFFINITY: Record<string, Record<string, number>> = {
  POL: { SOL: 1.15, NOR: 1.2, KAI: 0.5 },
  SFE: { NOR: 0.95, VAN: 0.9, SOL: 1.25 },
  COY: { KAI: 1.0, ZHE: 0.9, QIY: 1.3 },
  SAT: { KAI: 1.2, VAN: 0.9, ZHE: 1.0 },
  ECA: { KAI: 1.15, ZHE: 1.3 },
  TOL: { VAN: 1.1, KAI: 1.0, NOR: 1.3 },
  PUE: { KAI: 1.05, VAN: 1.0, ZHE: 1.1, QIY: 0.9 },
  QRO: { NOR: 1.1, VAN: 0.95, QIY: 1.15, SOL: 0.6 },
  PAC: { ZHE: 1.15, KAI: 1.05 },
  LEO: { VAN: 0.85, QIY: 1.0, KAI: 1.0 },
};

/** Truth: trim (base, mid, top) and color preferences by tier. */
const TRIM_PREF: Record<Tier, number[]> = {
  premiumUrban: [0.15, 0.38, 0.47],
  urbanMid: [0.3, 0.42, 0.28],
  suburban: [0.32, 0.43, 0.25],
  suburbanValue: [0.56, 0.31, 0.13],
  regional: [0.38, 0.38, 0.24],
  regionalGrowth: [0.34, 0.4, 0.26],
  regionalValue: [0.58, 0.3, 0.12],
};
// white, silver, gray, black, red, blue
const COLOR_PREF: Record<Tier, number[]> = {
  premiumUrban: [0.1, 0.13, 0.22, 0.29, 0.08, 0.18],
  urbanMid: [0.2, 0.18, 0.2, 0.22, 0.11, 0.09],
  suburban: [0.24, 0.27, 0.17, 0.16, 0.09, 0.07],
  suburbanValue: [0.39, 0.25, 0.12, 0.1, 0.09, 0.05],
  regional: [0.29, 0.22, 0.17, 0.19, 0.08, 0.05],
  regionalGrowth: [0.25, 0.21, 0.19, 0.21, 0.07, 0.07],
  regionalValue: [0.41, 0.26, 0.1, 0.08, 0.1, 0.05],
};

/** Truth: calendar seasonality for volume brands (Jan..Dec). Premium is damped. */
const SEASON_VOLUME = [0.8, 0.9, 1.0, 0.97, 1.0, 0.92, 0.9, 0.95, 0.98, 1.02, 1.17, 1.39];
const PREMIUM_DAMP = 0.45;
function trueSeason(group: "volume" | "premium", cal: number): number {
  const v = SEASON_VOLUME[cal];
  return group === "volume" ? v : 1 + PREMIUM_DAMP * (v - 1);
}

/** Coyoacán adds the Zhenlong franchise late: only a few months of history. */
const LATE_FRANCHISE: Record<string, Record<string, number>> = { COY: { ZHE: 21 } };

function lifecycle(brand: Brand, idx: number): number {
  if (!brand.launchMonth) return 1;
  const launchIdx = brand.launchMonth - 1;
  if (idx < launchIdx) return 0;
  return 1 - Math.exp(-(idx - launchIdx + 1) / 6);
}

function normalize(v: number[]): number[] {
  const s = v.reduce((a, b) => a + b, 0);
  return v.map((x) => x / s);
}

function noisyShares(rng: Rng, base: number[], sd: number): number[] {
  return normalize(base.map((x) => x * Math.exp(sd * rng.normal())));
}

const VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
function vin(rng: Rng, brand: string): string {
  const wmi = { KAI: "3KD", VAN: "3VT", NOR: "WNH", SOL: "ZSL", ZHE: "LZL", QIY: "LQY" }[brand] ?? "3XX";
  let s = wmi;
  for (let i = 0; i < 14; i++) s += VIN_CHARS[Math.floor(rng.uniform() * VIN_CHARS.length)];
  return s;
}

const round1000 = (x: number) => Math.round(x / 1000) * 1000;

export interface Generated {
  world: World;
  inventory: Unit[];
}

export function generate(seed: number): Generated {
  const rng = new Rng(seed);
  const stores: Store[] = STORES.map((s) => ({
    ...s,
    traffic: TRAFFIC[s.id],
    inboundCap: INBOUND[s.id],
  }));
  const brandById = Object.fromEntries(BRANDS.map((b) => [b.id, b]));

  // Store-level truth with small noise.
  const trimPref: Record<string, number[]> = {};
  const colorPref: Record<string, number[]> = {};
  const modelNoise: Record<string, Record<string, number>> = {};
  for (const s of stores) {
    trimPref[s.id] = noisyShares(rng, TRIM_PREF[s.tier], 0.06);
    colorPref[s.id] = noisyShares(rng, COLOR_PREF[s.tier], 0.06);
    modelNoise[s.id] = {};
    for (const m of MODELS) modelNoise[s.id][m.id] = Math.exp(0.08 * rng.normal());
  }

  const brandStart: Record<string, Record<string, number>> = {};
  for (const s of stores) {
    brandStart[s.id] = {};
    for (const b of s.brands) {
      const launch = brandById[b].launchMonth;
      const late = LATE_FRANCHISE[s.id]?.[b];
      brandStart[s.id][b] = (late ?? launch ?? 1) - 1;
    }
  }

  const trueRate = (storeId: string, modelId: string, idx: number) => {
    const m = MODELS.find((x) => x.id === modelId)!;
    const b = brandById[m.brand];
    const s = stores.find((x) => x.id === storeId)!;
    if (idx < brandStart[storeId][m.brand]) return 0;
    const cal = (HISTORY_START.month + idx) % 12;
    return (
      BASE_RATE[modelId] * RATE_SCALE * s.traffic * AFFINITY[storeId][m.brand] * modelNoise[storeId][modelId] * (MODEL_BOOST[storeId]?.[modelId] ?? 1) *
      trueSeason(b.seasonGroup, cal) * lifecycle(b, idx)
    );
  };

  const sales: World["sales"] = {};
  const trimCounts: World["trimCounts"] = {};
  const colorCounts: World["colorCounts"] = {};
  for (const s of stores) {
    sales[s.id] = {};
    trimCounts[s.id] = {};
    colorCounts[s.id] = {};
    for (const m of MODELS) {
      if (!s.brands.includes(m.brand)) continue;
      const series: number[] = [];
      const tc = [0, 0, 0];
      const cc = [0, 0, 0, 0, 0, 0];
      for (let i = 0; i < HISTORY_MONTHS; i++) {
        const y = rng.poisson(trueRate(s.id, m.id, i));
        series.push(y);
        const t = rng.multinomial(y, trimPref[s.id]);
        const c = rng.multinomial(y, colorPref[s.id]);
        t.forEach((v, j) => (tc[j] += v));
        c.forEach((v, j) => (cc[j] += v));
      }
      sales[s.id][m.id] = series;
      trimCounts[s.id][m.id] = tc;
      colorCounts[s.id][m.id] = cc;
    }
  }

  // Push allocation: volume by store traffic and group model mix, configuration mix ignores the store.
  const groupTrim = normalize(TRIM_PREF.regional.map((x, j) => 0.6 * x + 0.4 / 3 + 0 * j));
  const groupColor = normalize(COLOR_PREF.urbanMid.map((x) => 0.7 * x + 0.3 / 6));
  const COVER_MONTHS = 1.25;
  const AGE_SCALE = 0.88; // buyers sometimes accept a near configuration, so units turn a bit faster than exact-match demand
  const inventory: Unit[] = [];
  const nowIdx = HISTORY_MONTHS - 1;
  for (const s of stores) {
    for (const m of MODELS) {
      if (!s.brands.includes(m.brand)) continue;
      const b = brandById[m.brand];
      const groupLevel = BASE_RATE[m.id] * RATE_SCALE * lifecycle(b, nowIdx);
      const n = rng.poisson(groupLevel * s.traffic * COVER_MONTHS);
      const rateNow = trueRate(s.id, m.id, nowIdx) / trueSeason(b.seasonGroup, (HISTORY_START.month + nowIdx) % 12);
      const startIdx = brandStart[s.id][m.brand];
      const maxAge = Math.max(10, Math.round((nowIdx - startIdx) * 30.4 + 20));
      for (let i = 0; i < n; i++) {
        const trim = rng.categorical(groupTrim);
        const color = rng.categorical(groupColor);
        const h = (rateNow * trimPref[s.id][trim] * colorPref[s.id][color]) / 30.4; // per day
        const age = Math.min(maxAge, 320, Math.max(1, Math.round(AGE_SCALE * rng.exponential(Math.max(h, 1e-4)))));
        inventory.push(makeUnit(rng, s.id, m, b, trim, color, age));
      }
    }
  }

  plantStories(rng, inventory, brandById);

  inventory.sort((a, b) => (a.store === b.store ? a.id.localeCompare(b.id) : a.store.localeCompare(b.store)));

  const world: World = {
    seed,
    today: TODAY,
    historyStart: HISTORY_START,
    months: HISTORY_MONTHS,
    stores,
    brands: BRANDS,
    models: MODELS,
    trims: TRIMS,
    trimSteps: TRIM_STEPS,
    colors: COLORS,
    sales,
    trimCounts,
    colorCounts,
    brandStart,
  };
  return { world, inventory };
}

function makeUnit(rng: Rng, store: string, m: Model, b: Brand, trim: number, color: number, age: number, storyId?: number): Unit {
  const msrp = round1000(m.msrpBase * TRIM_STEPS[trim]);
  const cost = round1000(msrp * b.costRatio);
  const u: Unit = {
    id: vin(rng, b.id),
    store,
    brand: b.id,
    model: m.id,
    trim,
    color,
    cost,
    msrp,
    arrival: addDays(TODAY, -age),
    age,
  };
  if (storyId) u.storyId = storyId;
  return u;
}

interface StorySpec {
  storyId: number;
  store: string;
  model: string;
  trim: number;
  color: number;
  ages: number[];
  /** Remove same configuration units at these stores so the story is clean. */
  clearAt: string[];
  /** Cap same configuration units at these stores (keep at most n). */
  capAt?: Record<string, number>;
  /** Add young units of the same configuration (competing stock already in place). */
  fillAt?: Record<string, number[]>;
  /** Other configurations of the same model (so the story unit is not the last one on display). */
  companions?: { store: string; trim: number; color: number; age: number }[];
}

const STORIES: StorySpec[] = [
  // 1. Nordhaus N5 top black, 118 days in Toluca, sells faster in Polanco.
  { storyId: 1, store: "TOL", model: "N5", trim: 2, color: 3, ages: [118], clearAt: ["TOL", "POL"] },
  // 2. Five Kaido KX5 base white aging in Polanco.
  { storyId: 2, store: "POL", model: "KX5", trim: 0, color: 0, ages: [112, 105, 97, 90, 83], clearAt: ["POL", "SAT", "TOL"], capAt: { ECA: 1, PAC: 0, PUE: 0 }, fillAt: { SAT: [9, 21], TOL: [6, 15] } },
  // 3. Zhenlong Z7 at Coyoacán, few months of history.
  { storyId: 3, store: "COY", model: "Z7", trim: 1, color: 2, ages: [41], clearAt: ["COY"] },
  // 4. Vantor Summit at León, 75 days.
  { storyId: 4, store: "LEO", model: "SUMMIT", trim: 1, color: 4, ages: [75], clearAt: ["LEO"] },
  // 5. Kaido KX3 at Satélite, 70 days, keep for the season.
  { storyId: 5, store: "SAT", model: "KX3", trim: 2, color: 4, ages: [70], clearAt: ["SAT"] },
  // 6. Solenne Grand at Querétaro, 160 days.
  { storyId: 6, store: "QRO", model: "GRAND", trim: 1, color: 3, ages: [160], clearAt: ["QRO", "SFE", "POL"], companions: [{ store: "QRO", trim: 2, color: 0, age: 34 }] },
];

function plantStories(rng: Rng, inventory: Unit[], brandById: Record<string, Brand>) {
  for (const st of STORIES) {
    const same = (u: Unit, store: string) => u.store === store && u.model === st.model && u.trim === st.trim && u.color === st.color;
    for (const store of st.clearAt) {
      for (let i = inventory.length - 1; i >= 0; i--) if (same(inventory[i], store)) inventory.splice(i, 1);
    }
    for (const [store, cap] of Object.entries(st.capAt ?? {})) {
      let seen = 0;
      for (let i = inventory.length - 1; i >= 0; i--) {
        if (same(inventory[i], store)) {
          seen++;
          if (seen > cap) inventory.splice(i, 1);
        }
      }
    }
    const m = MODELS.find((x) => x.id === st.model)!;
    for (const [store, ages] of Object.entries(st.fillAt ?? {}))
      for (const age of ages) inventory.push(makeUnit(rng, store, m, brandById[m.brand], st.trim, st.color, age));
    for (const c of st.companions ?? []) inventory.push(makeUnit(rng, c.store, m, brandById[m.brand], c.trim, c.color, c.age));
    for (const age of st.ages) inventory.push(makeUnit(rng, st.store, m, brandById[m.brand], st.trim, st.color, age, st.storyId));
  }
}
