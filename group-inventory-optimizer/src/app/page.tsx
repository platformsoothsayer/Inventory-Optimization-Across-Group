"use client";
import { useApp } from "@/state/AppState";
import { Kpi, PageHeader, SectionTitle } from "@/components/ui";
import { NetworkMap, MapLegend } from "@/components/NetworkMap";
import { AgingBars } from "@/components/AgingBars";

export default function Panorama() {
  const { t, f, kpis, engine, assumptions, world } = useApp();
  const s = engine.result.summary;
  const summary = t("overview.summary", {
    transfers: f.int(s.transfers),
    prices: f.int(s.priceActions),
    savings: f.money(s.monthlyFloorplanSavings),
    capital: f.moneyCompact(s.capitalFreed90),
  });
  return (
    <div className="flex-1 min-h-0 flex flex-col px-8 pt-4 pb-3">
      <PageHeader title={t("overview.title")} subtitle={<span className="text-ink">{summary}</span>} />
      <div className="grid grid-cols-7 divide-x divide-line border-y border-line py-3 mb-4">
        <Kpi label={t("kpi.units")} value={f.int(kpis.units)} sub={t("kpi.unitsSub", { n: world.stores.length })} />
        <Kpi label={t("kpi.value")} value={f.moneyCompact(kpis.inventoryValue)} sub={t("kpi.valueSub")} />
        <Kpi label={t("kpi.avgDays")} value={f.int(kpis.avgDays)} sub={t("kpi.avgDaysSub")} />
        <Kpi label={t("kpi.over90")} value={f.int(kpis.over90)} sub={t("kpi.over90Sub", { pct: f.pct(kpis.over90Share) })} />
        <Kpi
          label={t("kpi.floorplan")}
          value={f.moneyCompact(kpis.monthlyFloorplan)}
          sub={kpis.approvedCount ? t("kpi.floorplanApprovedSub", { value: f.moneyCompact(kpis.monthlyFloorplanApproved) }) : t("kpi.floorplanSub", { rate: f.pct(assumptions.floorplanRate) })}
        />
        <Kpi
          accent
          label={t("kpi.savings")}
          value={f.money(kpis.planSavings)}
          sub2={<span className={kpis.approvedCount ? "text-teal-ink font-medium" : "text-muted"}>{kpis.approvedCount ? t("kpi.approvedSub", { value: f.money(kpis.approvedSavings) }) : t("kpi.notApproved")}</span>}
        />
        <Kpi
          accent
          label={t("kpi.capital")}
          value={f.moneyCompact(kpis.planCapital)}
          sub2={<span className={kpis.approvedCount ? "text-teal-ink font-medium" : "text-muted"}>{kpis.approvedCount ? t("kpi.approvedSub", { value: f.moneyCompact(kpis.approvedCapital) }) : t("kpi.notApproved")}</span>}
        />
      </div>
      <div className="grid grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-8 flex-1 min-h-0">
        <section className="flex flex-col min-h-0">
          <div className="relative flex-1 min-h-[22rem] bg-white border border-line rounded-sm">
            <div className="absolute left-4 top-3 z-[1] pointer-events-none">
              <h2 className="text-[1rem] font-semibold text-ink">{t("overview.mapTitle")}</h2>
            </div>
            <NetworkMap />
          </div>
          <div className="mt-2">
            <MapLegend />
          </div>
        </section>
        <section className="flex flex-col min-h-0">
          <SectionTitle sub={t("overview.agingSub")}>{t("overview.agingTitle")}</SectionTitle>
          <div className="mt-1">
            <AgingBars />
          </div>
        </section>
      </div>
    </div>
  );
}
