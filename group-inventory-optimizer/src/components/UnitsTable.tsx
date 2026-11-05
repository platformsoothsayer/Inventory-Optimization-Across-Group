"use client";
import { useMemo, useState } from "react";
import { useApp } from "@/state/AppState";
import { bucketOf } from "@/lib/kpis";
import { Badge, BrandDot } from "./ui";
import { palette } from "@/theme/tokens";
import { actionLabel, configLabel, riskOf } from "./labels";

type SortKey = "unit" | "store" | "config" | "days" | "p60" | "risk" | "floorplan" | "action" | "improvement";

export function UnitsTable({ pageSize }: { pageSize: number }) {
  const app = useApp();
  const { t, f, units, base, actionByUnit, statusOf, storeName, world, assumptions, selectedUnit, setSelectedUnit, present } = app;
  const [store, setStore] = useState("all");
  const [brand, setBrand] = useState("all");
  const [bucket, setBucket] = useState("all");
  const [action, setAction] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "improvement", dir: -1 });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    return units.map((u) => {
      const v = base.values[u.id];
      const a = actionByUnit.get(u.id);
      return {
        u,
        p60: v.p60,
        risk: riskOf(v.p60),
        floorplan: (u.cost * assumptions.floorplanRate * u.age) / 365,
        action: a,
        improvement: a?.improvement ?? 0,
        config: configLabel(app, u),
      };
    });
  }, [units, base, actionByUnit, assumptions.floorplanRate, app]);

  const filtered = useMemo(() => {
    const riskRank = { high: 0, medium: 1, low: 2 };
    const out = rows.filter(
      (r) =>
        (store === "all" || r.u.store === store) &&
        (brand === "all" || r.u.brand === brand) &&
        (bucket === "all" || String(bucketOf(r.u.age)) === bucket) &&
        (action === "all" || (action === "keep" ? !r.action : r.action?.type === action)),
    );
    const val = (r: (typeof rows)[number]): number | string => {
      switch (sort.key) {
        case "unit":
          return r.u.id;
        case "store":
          return storeName(r.u.store);
        case "config":
          return r.config;
        case "days":
          return r.u.age;
        case "p60":
          return r.p60;
        case "risk":
          return riskRank[r.risk];
        case "floorplan":
          return r.floorplan;
        case "action":
          return r.action ? (r.action.type === "transfer" ? 2 : 1) : 0;
        case "improvement":
          return r.improvement;
      }
    };
    out.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return c * sort.dir || b.u.age - a.u.age || a.u.id.localeCompare(b.u.id);
    });
    return out;
  }, [rows, store, brand, bucket, action, sort, storeName]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pg = Math.min(page, pages - 1);
  const visible = filtered.slice(pg * pageSize, pg * pageSize + pageSize);

  const head = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <th
      className={`px-3 py-2 font-medium text-muted text-[0.8rem] whitespace-nowrap cursor-pointer select-none hover:text-ink ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => {
        setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "unit" || key === "store" || key === "config" ? 1 : -1 }));
        setPage(0);
      }}
    >
      {label}
      <span className="inline-block w-3 text-teal-ink">{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : ""}</span>
    </th>
  );

  const select = (label: string, value: string, set: (v: string) => void, opts: { v: string; l: string }[]) => (
    <label className="flex items-center gap-2 text-[0.82rem] text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => {
          set(e.target.value);
          setPage(0);
        }}
        className="rounded-md bg-surface ring-1 ring-line px-2 py-1 text-[0.85rem] text-navy shadow-[0_1px_2px_rgb(11_31_58/0.05)]"
      >
        <option value="all">{t("filter.all")}</option>
        {opts.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center gap-5 mb-3 flex-wrap">
        {select(t("filter.store"), store, setStore, world.stores.map((s) => ({ v: s.id, l: s.name })))}
        {select(t("filter.brand"), brand, setBrand, world.brands.map((b) => ({ v: b.id, l: b.name })))}
        {select(t("filter.bucket"), bucket, setBucket, ["b0", "b1", "b2", "b3"].map((b, i) => ({ v: String(i), l: t(`bucket.${b}`) })))}
        {select(t("filter.action"), action, setAction, [
          { v: "transfer", l: t("action.typeTransfer") },
          { v: "discount", l: t("action.typeDiscount") },
          { v: "keep", l: t("action.typeKeep") },
        ])}
        <span className="ml-auto text-[0.85rem] text-muted tnum">{t("units.count", { n: f.int(filtered.length) })}</span>
      </div>
      <div className="panel overflow-hidden anim-rise">
        <table className="w-full text-[0.85rem] tnum">
          <thead className="border-b border-line bg-bg/60">
            <tr>
              {head("unit", t("col.unit"))}
              {head("store", t("col.store"))}
              {head("config", t("col.config"))}
              {head("days", t("col.days"), "right")}
              {head("p60", t("col.p60"), "right")}
              {head("risk", t("col.risk"))}
              {head("floorplan", t("col.floorplan"), "right")}
              {head("action", t("col.action"))}
              {head("improvement", t("col.improvement"), "right")}
              <th className="px-3 py-2 font-medium text-muted text-[0.8rem] text-left">{t("col.status")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const st = r.action ? statusOf(r.action.id) : null;
              const sel = selectedUnit === r.u.id;
              return (
                <tr
                  key={r.u.id}
                  onClick={() => setSelectedUnit(r.u.id)}
                  className={`border-b border-line-2 last:border-0 cursor-pointer ${sel ? "bg-teal-soft" : "hover:bg-bg"}`}
                >
                  <td className="px-3 py-[0.45rem] font-mono text-[0.8rem] text-muted">{r.u.id.slice(-8)}</td>
                  <td className="px-3 py-[0.45rem] whitespace-nowrap">{storeName(r.u.store)}</td>
                  <td className="px-3 py-[0.45rem] whitespace-nowrap"><span className="inline-flex items-center gap-2"><BrandDot brand={r.u.brand} />{r.config}</span></td>
                  <td className="px-3 py-[0.45rem] text-right">
                    <span className={r.u.age > 90 ? "font-semibold" : ""} style={r.u.age > 90 ? { boxShadow: `inset 0 -2px 0 ${palette.coral}` } : undefined}>{r.u.age}</span>
                  </td>
                  <td className="px-3 py-[0.45rem] text-right">{f.pct(r.p60)}</td>
                  <td className="px-3 py-[0.45rem]">
                    <Badge tone={r.risk === "high" ? "a3" : r.risk === "medium" ? "a2" : "a0"} icon={<span aria-hidden>{r.risk === "high" ? "▲" : r.risk === "medium" ? "●" : "▼"}</span>}>{t(`risk.${r.risk}`)}</Badge>
                  </td>
                  <td className="px-3 py-[0.45rem] text-right">{f.money(r.floorplan)}</td>
                  <td className="px-3 py-[0.45rem] whitespace-nowrap">
                    {r.action ? <span className="text-deep-teal font-medium inline-flex items-center gap-1.5"><span aria-hidden>{r.action.type === "transfer" ? "⇄" : "%"}</span>{actionLabel(app, r.action)}</span> : <span className="text-muted">{t("action.keep")}</span>}
                  </td>
                  <td className="px-3 py-[0.45rem] text-right">{r.improvement > 0 ? <span className="font-medium">+{f.money(r.improvement)}</span> : <span className="text-muted">0</span>}</td>
                  <td className="px-3 py-[0.45rem]">{st && <Badge tone={st === "approved" ? "approved" : st === "rejected" ? "rejected" : "proposed"}>{t(`status.${st}`)}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!present && (
        <div className="flex items-center justify-end gap-3 mt-3 text-[0.85rem] text-muted">
          <button className="px-2 py-1 disabled:opacity-40" disabled={pg === 0} onClick={() => setPage(pg - 1)}>
            {t("pager.prev")}
          </button>
          <span className="tnum">{t("pager.page", { p: pg + 1, n: pages })}</span>
          <button className="px-2 py-1 disabled:opacity-40" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>
            {t("pager.next")}
          </button>
        </div>
      )}
    </div>
  );
}
