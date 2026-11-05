"use client";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/state/AppState";
import { PageHeader } from "@/components/ui";
import { UnitsTable } from "@/components/UnitsTable";
import { UnitDetail } from "@/components/UnitDetail";

export default function UnitsPage() {
  const { t, selectedUnit, setSelectedUnit, present, units } = useApp();
  const params = useSearchParams();
  const story = params.get("story");
  // Deep link by planted story id (used for reproducible screenshots).
  const unitId = selectedUnit ?? (story ? (units.find((u) => String(u.storyId) === story)?.id ?? null) : null);
  return (
    <div className="flex-1 min-h-0 flex flex-col px-8 pt-4 pb-3 relative">
      <PageHeader title={t("units.title")} subtitle={t("units.subtitle")} />
      <UnitsTable pageSize={present ? 16 : 18} />
      {unitId && (
        <>
          <div className="absolute inset-0 bg-navy/10 z-10" onClick={() => setSelectedUnit(null)} />
          <UnitDetail key={unitId} unitId={unitId} onClose={() => setSelectedUnit(null)} />
        </>
      )}
    </div>
  );
}
