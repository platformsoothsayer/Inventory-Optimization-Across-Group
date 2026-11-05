"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import worldJson from "@/data/world.json";
import inventoryJson from "@/data/inventory.json";
import type { Assumptions, PlanAction, Segment, Unit, World } from "@/lib/types";
import { createDemand, runEngine, type Engine } from "@/lib/engine";
import { DEFAULT_ASSUMPTIONS } from "@/lib/economics";
import { evaluateScenario, type ScenarioResult } from "@/lib/scenario";
import { computeKpis, type PanoramaKpis } from "@/lib/kpis";
import { runBacktest, type BacktestResult } from "@/lib/backtest";
import { buildGroups } from "@/lib/explain";
import { project, type ProjectionPoint } from "@/lib/projection";
import { translate, type DictKey, type Lang } from "@/i18n";
import { makeFormat, type Fmt } from "@/lib/format";

const world = worldJson as unknown as World;
const units = inventoryJson as unknown as Unit[];

interface PersistState {
  assumptions: Assumptions;
  approved: string[];
  rejected: string[];
}

type Action =
  | { type: "setAssumption"; key: Exclude<keyof Assumptions, "elasticity">; value: number }
  | { type: "setElasticity"; segment: Segment; value: number }
  | { type: "approve"; ids: string[] }
  | { type: "reject"; id: string }
  | { type: "undo"; id: string }
  | { type: "reset" }
  | { type: "load"; state: PersistState };

const initial: PersistState = { assumptions: DEFAULT_ASSUMPTIONS, approved: [], rejected: [] };

function reducer(s: PersistState, a: Action): PersistState {
  switch (a.type) {
    case "setAssumption":
      return { ...s, assumptions: { ...s.assumptions, [a.key]: a.value } };
    case "setElasticity":
      return { ...s, assumptions: { ...s.assumptions, elasticity: { ...s.assumptions.elasticity, [a.segment]: a.value } } };
    case "approve": {
      const set = new Set(s.approved);
      a.ids.forEach((id) => set.add(id));
      return { ...s, approved: [...set], rejected: s.rejected.filter((id) => !a.ids.includes(id)) };
    }
    case "reject":
      return { ...s, rejected: [...new Set([...s.rejected, a.id])], approved: s.approved.filter((id) => id !== a.id) };
    case "undo":
      return { ...s, approved: s.approved.filter((id) => id !== a.id), rejected: s.rejected.filter((id) => id !== a.id) };
    case "reset":
      return initial;
    case "load":
      return a.state;
  }
}

export type ActionStatus = "proposed" | "approved" | "rejected";

export interface AppValue {
  lang: Lang;
  present: boolean;
  t: (key: DictKey | string, params?: Record<string, string | number>) => string;
  f: Fmt;
  world: World;
  units: Unit[];
  engine: Engine;
  base: ScenarioResult;
  proj: { base: ProjectionPoint[]; plan: ProjectionPoint[] };
  groups: ReturnType<typeof buildGroups>;
  actionByUnit: Map<string, PlanAction>;
  statusOf: (actionId: string) => ActionStatus;
  approvedActions: PlanAction[];
  kpis: PanoramaKpis;
  backtest: BacktestResult;
  assumptions: Assumptions;
  pendingRecalc: boolean;
  dispatch: (a: Action) => void;
  storeName: (id: string) => string;
  modelName: (id: string) => string;
  brandName: (id: string) => string;
  href: (path: string, extra?: Record<string, string | null>) => string;
  setLang: (l: Lang) => void;
  selectedUnit: string | null;
  setSelectedUnit: (id: string | null) => void;
}

const Ctx = createContext<AppValue | null>(null);
const STORAGE_KEY = "gio-state-v1";

export function AppStateProvider({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const lang: Lang = params.get("lang") === "en" ? "en" : "es";
  const present = params.get("present") === "1";
  const [state, dispatch] = useReducer(reducer, initial);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "load", state: { ...initial, ...JSON.parse(raw) } });
    } catch {
      /* storage unavailable */
    }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable */
    }
  }, [state]);

  // Debounced assumptions drive the optimizer.
  const [debounced, setDebounced] = useState(state.assumptions);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(state.assumptions), 250);
    return () => clearTimeout(id);
  }, [state.assumptions]);

  const dm = useMemo(() => createDemand(world), []);
  const backtest = useMemo(() => runBacktest(world), []);
  const groups = useMemo(() => buildGroups(units), []);
  const engine = useMemo(() => runEngine(world, units, dm, debounced), [dm, debounced]);
  const base = useMemo(() => evaluateScenario(engine.ctx, units, []), [engine]);
  const proj = useMemo(() => {
    const planScenario = evaluateScenario(engine.ctx, units, engine.result.actions);
    return {
      base: project(engine.ctx.curves, units, base, debounced.floorplanRate),
      plan: project(engine.ctx.curves, units, planScenario, debounced.floorplanRate),
    };
  }, [engine, base, debounced.floorplanRate]);
  const actionByUnit = useMemo(() => new Map(engine.result.actions.map((a) => [a.unitId, a])), [engine]);
  const approvedSet = useMemo(() => new Set(state.approved), [state.approved]);
  const rejectedSet = useMemo(() => new Set(state.rejected), [state.rejected]);
  const approvedActions = useMemo(() => engine.result.actions.filter((a) => approvedSet.has(a.id)), [engine, approvedSet]);
  const kpis = useMemo(
    () => computeKpis(engine.ctx, units, engine.result.base, engine.result.plan, approvedActions),
    [engine, approvedActions],
  );

  const t = useCallback((key: DictKey | string, p?: Record<string, string | number>) => translate(lang, key, p), [lang]);
  const f = useMemo(() => makeFormat(lang), [lang]);
  const storeMap = useMemo(() => Object.fromEntries(world.stores.map((s) => [s.id, s.name])), []);
  const modelMap = useMemo(() => Object.fromEntries(world.models.map((m) => [m.id, m.name])), []);
  const brandMap = useMemo(() => Object.fromEntries(world.brands.map((b) => [b.id, b.name])), []);

  const href = useCallback(
    (path: string, extra?: Record<string, string | null>) => {
      const q = new URLSearchParams();
      if (lang === "en") q.set("lang", "en");
      else q.set("lang", "es");
      if (present) q.set("present", "1");
      for (const [k, v] of Object.entries(extra ?? {})) if (v !== null) q.set(k, v);
      return `${path}?${q.toString()}`;
    },
    [lang, present],
  );
  const setLang = useCallback(
    (l: Lang) => {
      const q = new URLSearchParams(params.toString());
      q.set("lang", l);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );
  const selectedUnit = params.get("unit");
  const setSelectedUnit = useCallback(
    (id: string | null) => {
      const q = new URLSearchParams(params.toString());
      if (id) q.set("unit", id);
      else q.delete("unit");
      q.delete("story");
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const value: AppValue = {
    lang,
    present,
    t,
    f,
    world,
    units,
    engine,
    base,
    proj,
    groups,
    actionByUnit,
    statusOf: (id) => (approvedSet.has(id) ? "approved" : rejectedSet.has(id) ? "rejected" : "proposed"),
    approvedActions,
    kpis,
    backtest,
    assumptions: state.assumptions,
    pendingRecalc: debounced !== state.assumptions,
    dispatch,
    storeName: (id) => storeMap[id] ?? id,
    modelName: (id) => modelMap[id] ?? id,
    brandName: (id) => brandMap[id] ?? id,
    href,
    setLang,
    selectedUnit,
    setSelectedUnit,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}
