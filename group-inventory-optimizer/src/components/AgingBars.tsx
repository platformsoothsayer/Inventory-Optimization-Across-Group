"use client";
import { useApp } from "@/state/AppState";
import { AGING_COLORS } from "./ui";

export function AgingBars() {
  const { kpis, t, storeName } = useApp();
  const rows = [...kpis.stores].sort((a, b) => b.over90 - a.over90 || b.units - a.units);
  const max = Math.max(...rows.map((r) => r.units));
  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[0.8rem] text-muted">
        {["b0", "b1", "b2", "b3"].map((b, i) => (
          <span key={b} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: AGING_COLORS[i] }} />
            {t(`bucket.${b}`)}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-[0.55rem]">
        {rows.map((r) => (
          <div key={r.store} className="grid grid-cols-[6.5rem_1fr_2.6rem] items-center gap-3">
            <div className="text-[0.88rem] text-ink truncate">{storeName(r.store)}</div>
            <div className="flex h-[1.15rem]" style={{ width: `${(r.units / max) * 100}%` }} title={`${r.units}`}>
              {r.buckets.map((n, i) => (
                <div key={i} className="h-full flex items-center justify-center text-[0.7rem] font-medium tnum" style={{ width: `${(n / r.units) * 100}%`, background: AGING_COLORS[i], color: i >= 2 ? "#fff" : "#4b3f22" }}>
                  {n >= 7 ? n : ""}
                </div>
              ))}
            </div>
            <div className="text-[0.85rem] tnum text-right text-muted">{r.units}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
