import type { PlanAction, Unit, World } from "@/lib/types";
import type { AppValue } from "@/state/AppState";

export function configLabel(app: Pick<AppValue, "t" | "modelName" | "brandName" | "world">, u: Unit, withBrand = true): string {
  const trim = app.t(`trim.${app.world.trims[u.trim]}`);
  const color = app.t(`color.${app.world.colors[u.color]}`);
  return `${withBrand ? app.brandName(u.brand) + " " : ""}${app.modelName(u.model)} / ${trim} / ${color}`;
}

export function actionLabel(app: Pick<AppValue, "t" | "f" | "storeName">, a: PlanAction | undefined): string {
  if (!a) return app.t("action.keep");
  if (a.type === "transfer") return app.t("action.transfer", { store: app.storeName(a.to!) });
  return app.t("action.discount", { pct: app.f.pct(a.discount ?? 0) });
}

export function riskOf(p60: number): "high" | "medium" | "low" {
  return p60 < 0.35 ? "high" : p60 < 0.65 ? "medium" : "low";
}

export function bodyLabel(app: Pick<AppValue, "t">, world: World, modelId: string): string {
  const m = world.models.find((x) => x.id === modelId);
  return m ? app.t(`body.${m.body}`) : "";
}
