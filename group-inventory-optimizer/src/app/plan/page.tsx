"use client";
import { useApp } from "@/state/AppState";
import { AssumptionRail } from "@/components/AssumptionRail";
import { PlanView } from "@/components/PlanView";

export default function PlanPage() {
  const { present } = useApp();
  return (
    <div className="flex-1 min-h-0 flex">
      {!present && <AssumptionRail />}
      <PlanView />
    </div>
  );
}
