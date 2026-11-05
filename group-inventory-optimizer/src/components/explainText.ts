import type { Explanation } from "@/lib/explain";
import type { AppValue } from "@/state/AppState";

/** Fill the bilingual template for an explanation. Every number comes from the computed explanation. */
export function explanationText(app: Pick<AppValue, "t" | "f" | "storeName" | "assumptions">, e: Explanation): string {
  const { t, f, storeName } = app;
  const u = e.unit;
  const c = e.chosen;
  const k = e.keep;
  if (e.kind === "transfer") {
    return t("explain.transfer", {
      age: u.age,
      from: storeName(u.store),
      to: storeName(c.store),
      ratio: f.dec1(e.speedRatio),
      cost: f.money(c.value.transferCost),
      fp: f.money(Math.max(0, k.value.floorplan - c.value.floorplan)),
      net: f.money(e.improvement),
    });
  }
  if (e.kind === "leastLoss") {
    return t("explain.leastLoss", {
      age: u.age,
      from: storeName(u.store),
      to: storeName(c.store),
      ev: f.money(c.value.ev),
      keepEv: f.money(k.value.ev),
      ratio: f.dec1(e.speedRatio),
    });
  }
  if (e.kind === "discount") {
    const base = { age: u.age, store: storeName(u.store), pct: f.pct(c.discount), p0: f.pct(k.value.p60), p1: f.pct(c.value.p60), net: f.money(e.improvement) };
    const bt = e.bestTransfer;
    if (!bt) return t("explain.discountOnly", base);
    if (bt.gain < 0) return t("explain.discountNoTransfer", { ...base, best: storeName(bt.store), cost: f.money(bt.value.transferCost), gain: f.moneySigned(bt.gain) });
    return t("explain.discountTransferLess", { ...base, best: storeName(bt.store), gain: f.money(bt.gain) });
  }
  // keep
  const alternatives = e.options.filter((o) => o.kind !== "keep").sort((a, b) => b.gain - a.gain);
  const best = alternatives[0];
  if (best && best.gain >= app.assumptions.minImprovement) {
    const option = best.kind === "transfer" ? t("action.transfer", { store: storeName(best.store) }) : t("action.discount", { pct: f.pct(best.discount) });
    return t("explain.keepBlocked", { age: u.age, store: storeName(u.store), option: option.toLowerCase(), gain: f.moneySigned(best.gain) });
  }
  if (e.seasonLift > 0.03 && e.bestTransfer) {
    return t("explain.keepSeason", {
      age: u.age,
      store: storeName(u.store),
      season: f.pct(e.seasonLift),
      best: storeName(e.bestTransfer.store),
      cost: f.money(e.bestTransfer.value.transferCost),
      gain: f.moneySigned(e.bestTransfer.gain),
    });
  }
  return t("explain.keepPlain", { age: u.age, store: storeName(u.store), p60: f.pct(k.value.p60), threshold: f.money(app.assumptions.minImprovement) });
}
