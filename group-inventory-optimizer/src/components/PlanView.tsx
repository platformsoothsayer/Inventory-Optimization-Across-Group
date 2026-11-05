"use client";
import { Fragment, useState } from "react";
import { useApp } from "@/state/AppState";
import { Badge, Button, Kpi, SectionTitle } from "./ui";
import { configLabel } from "./labels";

export function PlanView() {
  const app = useApp();
  const { t, f, engine, statusOf, dispatch, storeName, units, present, setSelectedUnit, href } = app;
  const r = engine.result;
  const s = r.summary;
  const [open, setOpen] = useState<string | null>(null);
  const unitById = new Map(units.map((u) => [u.id, u]));
  const actionByUnit = new Map(r.actions.map((a) => [a.unitId, a]));
  const approvedN = r.actions.filter((a) => statusOf(a.id) === "approved").length;
  const transfers = r.actions.filter((a) => a.type === "transfer");
  const prices = r.actions.filter((a) => a.type === "discount");
  const proposedIds = (ids: string[]) => ids.filter((id) => statusOf(id) !== "approved");

  return (
    <div className="flex-1 min-w-0 flex flex-col px-8 pt-4 pb-3 min-h-0">
      <div className="flex items-end justify-between gap-6 mb-3">
        <div>
          <h1 className="text-[1.5rem] font-semibold text-ink leading-tight">{t("plan.title")}</h1>
          <div className="text-[0.95rem] text-muted mt-1">{t("plan.subtitle")}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[0.85rem] text-muted tnum">{t("plan.approvedOf", { a: approvedN, n: r.actions.length })}</span>
          <Button onClick={() => dispatch({ type: "approve", ids: proposedIds(r.actions.map((a) => a.id)) })} disabled={approvedN === r.actions.length}>
            {t("btn.approveAll")}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-5 divide-x divide-line border-y border-line py-3 mb-4">
        <Kpi label={t("plan.totalTransfers")} value={f.int(s.transfers)} sub={t("plan.transferCostSub", { value: f.money(s.transferCost) })} />
        <Kpi label={t("plan.totalPrices")} value={f.int(s.priceActions)} sub={t("plan.pricesSub", { value: f.money(r.plan.discountCost) })} />
        <Kpi accent label={t("plan.totalSavings")} value={f.money(s.monthlyFloorplanSavings)} sub={t("plan.floorplanDelta", { from: f.moneyCompact(r.base.floorplan90 / 3), to: f.moneyCompact(r.plan.floorplan90 / 3) })} />
        <Kpi accent label={t("plan.totalCapital")} value={f.moneyCompact(s.capitalFreed90)} sub={t("plan.capitalDelta", { from: f.int(r.base.expectedSold90), to: f.int(r.plan.expectedSold90) })} />
        <Kpi label={t("plan.totalDays")} value={t("plan.daysValue", { n: f.int(s.daysReduction) })} sub={t("plan.daysSub")} />
      </div>
      <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-6 flex-1 min-h-0">
        <section className="flex flex-col min-h-0">
          <SectionTitle sub={t("plan.routesSub")}>{t("plan.routes")}</SectionTitle>
          <div className={`bg-white border border-line rounded-sm ${present ? "overflow-hidden" : "overflow-auto scroll-thin"} min-h-0 flex-1`}>
            <table className="w-full text-[0.85rem] tnum">
              <thead className="border-b border-line bg-[#fafbfc] sticky top-0">
                <tr className="text-muted text-[0.8rem] whitespace-nowrap">
                  <th className="text-left font-medium px-2.5 py-2">{t("col.route")}</th>
                  <th className="text-right font-medium px-2.5 py-2">{t("col.units")}</th>
                  <th className="text-right font-medium px-2.5 py-2">{t("col.loads")}</th>
                  <th className="text-right font-medium px-2.5 py-2">{t("col.distance")}</th>
                  <th className="text-right font-medium px-2.5 py-2">{t("col.cost")}</th>
                  <th className="text-right font-medium px-2.5 py-2">{t("col.value")}</th>
                  <th className="px-2.5 py-2" />
                </tr>
              </thead>
              <tbody>
                {(present ? s.routes.slice(0, 8) : s.routes).map((rt) => {
                  const key = `${rt.from}>${rt.to}`;
                  const ids = rt.unitIds.map((u) => actionByUnit.get(u)!.id);
                  const nApproved = ids.filter((id) => statusOf(id) === "approved").length;
                  const isOpen = open === key;
                  return (
                    <Fragment key={key}>
                      <tr className="border-b border-line-2">
                        <td className="px-2.5 py-[0.42rem] whitespace-nowrap">
                          <button className="text-left hover:text-teal-ink" onClick={() => setOpen(isOpen ? null : key)} title={isOpen ? t("btn.hideUnits") : t("btn.showUnits")}>
                            <span className="text-faint mr-1.5 inline-block w-2">{isOpen ? "▾" : "▸"}</span>
                            <span className="font-medium">{storeName(rt.from)}</span>
                            <span className="text-teal-ink mx-1.5">→</span>
                            <span className="font-medium">{storeName(rt.to)}</span>
                          </button>
                        </td>
                        <td className="px-2.5 py-[0.42rem] text-right">{rt.unitIds.length}</td>
                        <td className="px-2.5 py-[0.42rem] text-right">{rt.loads}</td>
                        <td className="px-2.5 py-[0.42rem] text-right">{t("plan.km", { n: f.int(rt.km) })}</td>
                        <td className="px-2.5 py-[0.42rem] text-right">{f.money(rt.cost)}</td>
                        <td className="px-2.5 py-[0.42rem] text-right font-medium">{f.money(rt.value)}</td>
                        <td className="px-2.5 py-[0.42rem] text-right whitespace-nowrap">
                          {nApproved === ids.length ? (
                            <Badge tone="approved">{t("status.approved")}</Badge>
                          ) : (
                            <Button small variant="secondary" onClick={() => dispatch({ type: "approve", ids: proposedIds(ids) })}>
                              {t("btn.approveRoute")}
                            </Button>
                          )}
                        </td>
                      </tr>
                      {isOpen &&
                        rt.unitIds.map((uid) => {
                          const a = actionByUnit.get(uid)!;
                          const u = unitById.get(uid)!;
                          const st = statusOf(a.id);
                          return (
                            <tr key={uid} className="bg-[#fafbfc] border-b border-line-2 text-[0.82rem]">
                              <td className="pl-9 pr-3 py-1.5" colSpan={3}>
                                <a href={href("/unidades/", { unit: uid })} onClick={(e) => { e.preventDefault(); setSelectedUnit(uid); window.location.href = href("/unidades/", { unit: uid }); }} className="hover:text-teal-ink">
                                  {configLabel(app, u)}
                                </a>
                                <span className="text-muted ml-2">{u.age} d</span>
                              </td>
                              <td className="px-2.5 py-1.5" />
                              <td className="px-2.5 py-1.5" />
                              <td className="px-2.5 py-1.5 text-right">{f.money(a.improvement)}</td>
                              <td className="px-2.5 py-1.5 text-right">
                                {st === "proposed" ? (
                                  <span className="inline-flex gap-1.5">
                                    <Button small onClick={() => dispatch({ type: "approve", ids: [a.id] })}>{t("btn.approve")}</Button>
                                    <Button small variant="secondary" onClick={() => dispatch({ type: "reject", id: a.id })}>{t("btn.reject")}</Button>
                                  </span>
                                ) : (
                                  <button className="text-[0.8rem] text-muted hover:text-ink" onClick={() => dispatch({ type: "undo", id: a.id })}>
                                    <Badge tone={st === "approved" ? "approved" : "rejected"}>{t(`status.${st}`)}</Badge> <span className="ml-1 underline">{t("btn.undo")}</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="flex flex-col min-h-0 gap-4">
          <Constraints />
          <div className="flex flex-col min-h-0 flex-1">
            <SectionTitle sub={t("plan.pricesList")}>
              {t("plan.prices")} <span className="text-muted font-normal tnum">({prices.length})</span>
            </SectionTitle>
            <div className={`bg-white border border-line rounded-sm ${present ? "overflow-hidden" : "overflow-y-auto scroll-thin"} min-h-0 flex-1`}>
              <table className="w-full text-[0.85rem] tnum">
                <tbody>
                  {(present ? prices.slice(0, 2) : prices).map((a) => {
                    const u = unitById.get(a.unitId)!;
                    const st = statusOf(a.id);
                    return (
                      <tr key={a.id} className="border-b border-line-2">
                        <td className="px-2 py-[0.42rem] whitespace-nowrap">{storeName(u.store)}</td>
                        <td className="px-2 py-[0.42rem] whitespace-nowrap">{configLabel(app, u, false)}</td>
                        <td className="px-2 py-[0.42rem] text-right text-muted whitespace-nowrap">{u.age} d</td>
                        <td className="px-2 py-[0.42rem] text-right font-medium text-teal-ink">{f.pct(a.discount ?? 0)}</td>
                        <td className="px-2 py-[0.42rem] text-right">{f.money(a.improvement)}</td>
                        <td className="px-2 py-[0.42rem] text-right">
                          {st === "proposed" ? (
                            <Button small variant="secondary" onClick={() => dispatch({ type: "approve", ids: [a.id] })}>{t("btn.approve")}</Button>
                          ) : (
                            <Badge tone={st === "approved" ? "approved" : "rejected"}>{t(`status.${st}`)}</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
      {transfers.length === 0 && <div className="text-muted text-[0.9rem] mt-2">{t("plan.routes")}: 0</div>}
    </div>
  );
}

function Constraints() {
  const { t, f, engine, assumptions, storeName } = useApp();
  const b = engine.result.binding;
  const rows: { text: string; binding: boolean }[] = [
    { text: t("cons.weekly", { used: b.weeklyUsed, cap: b.weeklyCap }), binding: b.weeklyUsed >= b.weeklyCap },
    ...(b.fullStores.length
      ? b.fullStores.map((s) => ({ text: t("cons.inboundFull", { store: storeName(s), used: b.inboundUsed[s], cap: b.inboundCap[s] }), binding: true }))
      : [{ text: t("cons.inboundOk"), binding: false }]),
    { text: b.displayBlocked ? t("cons.display", { n: b.displayBlocked }) : t("cons.displayNone"), binding: b.displayBlocked > 0 },
    { text: t("cons.brand"), binding: false },
    { text: b.atMaxDiscount ? t("cons.discount", { n: b.atMaxDiscount, total: engine.result.summary.priceActions, pct: f.pct(assumptions.maxDiscount) }) : t("cons.discountNone", { pct: f.pct(assumptions.maxDiscount) }), binding: b.atMaxDiscount > 0 },
  ];
  return (
    <div>
      <SectionTitle>{t("plan.constraints")}</SectionTitle>
      <div className="flex flex-col divide-y divide-line-2 border-y border-line">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-[0.4rem] text-[0.85rem]">
            <span className="text-ink tnum">{r.text}</span>
            <Badge tone={r.binding ? "a2" : "neutral"}>{r.binding ? t("cons.binding") : t("cons.slack")}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
