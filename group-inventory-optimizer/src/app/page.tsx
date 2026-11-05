"use client";
import { useApp } from "@/state/AppState";
import { DeltaChip, Kpi, PageHeader, Panel, SectionTitle } from "@/components/ui";
import { NetworkMap, MapLegend } from "@/components/NetworkMap";
import { AgingBars } from "@/components/AgingBars";
import { palette } from "@/theme/tokens";
import type { ProjectionPoint } from "@/lib/projection";

export default function Panorama() {
  const { t, f, kpis, engine, assumptions, world, proj } = useApp();
  const s = engine.result.summary;
  const summary = t("overview.summary", {
    transfers: f.int(s.transfers),
    prices: f.int(s.priceActions),
    savings: f.money(s.monthlyFloorplanSavings),
    capital: f.moneyCompact(s.capitalFreed90),
  });
  const pb = proj.base;
  const pp = proj.plan;
  const last = pp.length - 1;
  const series = (k: keyof ProjectionPoint) => ({ spark: pp.map((p) => p[k]), sparkBase: pb.map((p) => p[k]) });
  const change = (k: keyof ProjectionPoint) => (pp[last][k] - pb[last][k]) / pb[last][k];
  const chip = (k: keyof ProjectionPoint, goodWhen: "up" | "down") => <DeltaChip value={change(k)} goodWhen={goodWhen} format={f.pct1Signed} />;
  const savingsShare = -s.monthlyFloorplanSavings / (engine.result.base.floorplan90 / 3);
  const approvedLine = (txt: string) => <span className={kpis.approvedCount ? "text-deep-teal font-medium" : "text-muted"}>{txt}</span>;

  return (
    <div className="flex-1 min-h-0 flex flex-col px-8 pt-4 pb-3">
      <PageHeader
        title={t("overview.title")}
        subtitle={
          <span className="text-navy inline-flex items-center gap-2">
            <span className="inline-block w-1 h-4 rounded-full bg-teal" aria-hidden />
            {summary}
          </span>
        }
      />
      <Panel className="px-2 pt-2.5 pb-2 mb-3.5">
        <div className="grid grid-cols-7 divide-x divide-line">
          <Kpi label={t("kpi.units")} value={f.int(kpis.units)} {...series("units")} delta={chip("units", "down")} sub={t("kpi.unitsSub", { n: world.stores.length })} />
          <Kpi label={t("kpi.value")} value={f.moneyCompact(kpis.inventoryValue)} {...series("value")} delta={chip("value", "down")} sub={t("kpi.valueSub")} />
          <Kpi label={t("kpi.avgDays")} value={f.int(kpis.avgDays)} {...series("avgAge")} delta={chip("avgAge", "down")} sub={t("kpi.avgDaysSub")} />
          <Kpi label={t("kpi.over90")} value={f.int(kpis.over90)} {...series("over90")} sparkColor={palette.coral} delta={chip("over90", "down")} sub={t("kpi.over90Sub", { pct: f.pct(kpis.over90Share) })} />
          <Kpi
            label={t("kpi.floorplan")}
            value={f.moneyCompact(kpis.monthlyFloorplan)}
            {...series("monthlyFloorplan")}
            delta={chip("monthlyFloorplan", "down")}
            sub={kpis.approvedCount ? t("kpi.floorplanApprovedSub", { value: f.moneyCompact(kpis.monthlyFloorplanApproved) }) : t("kpi.floorplanSub", { rate: f.pct(assumptions.floorplanRate) })}
          />
          <Kpi
            accent="gain"
            label={t("kpi.savings")}
            value={f.money(kpis.planSavings)}
            spark={pb.map((p, i) => p.monthlyFloorplan - pp[i].monthlyFloorplan)}
            sparkColor={palette.green}
            delta={<DeltaChip value={savingsShare} goodWhen="down" format={f.pct1Signed} />}
            sub2={approvedLine(kpis.approvedCount ? t("kpi.approvedSub", { value: f.money(kpis.approvedSavings) }) : t("kpi.notApproved"))}
          />
          <Kpi
            accent="gain"
            label={t("kpi.capital")}
            value={f.moneyCompact(kpis.planCapital)}
            spark={pp.map((p, i) => p.capitalSold - pb[i].capitalSold)}
            sparkColor={palette.green}
            delta={chip("capitalSold", "up")}
            sub2={approvedLine(kpis.approvedCount ? t("kpi.approvedSub", { value: f.moneyCompact(kpis.approvedCapital) }) : t("kpi.notApproved"))}
          />
        </div>
        <div className="text-[0.72rem] text-muted px-4 mt-1">{t("kpi.trendNote")}</div>
      </Panel>
      <div className="grid grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-6 flex-1 min-h-0">
        <Panel className="flex flex-col min-h-0 overflow-hidden" delay={80}>
          <div className="relative flex-1 min-h-[21rem]">
            <div className="absolute left-5 top-3.5 z-[1] pointer-events-none">
              <h2 className="text-[1rem] font-semibold text-navy">{t("overview.mapTitle")}</h2>
            </div>
            <NetworkMap />
          </div>
          <div className="px-5 py-1.5 border-t border-line">
            <MapLegend />
          </div>
        </Panel>
        <Panel className="flex flex-col min-h-0 px-5 py-3" delay={140}>
          <SectionTitle sub={t("overview.agingSub")}>{t("overview.agingTitle")}</SectionTitle>
          <div className="mt-1 flex-1 min-h-0">
            <AgingBars />
          </div>
        </Panel>
      </div>
    </div>
  );
}
