"use client";
import { useApp } from "@/state/AppState";
import { AGING_COLORS } from "./ui";
import { palette } from "@/theme/tokens";

export function AgingBars() {
  const { kpis, t, storeName } = useApp();
  const rows = [...kpis.stores].sort((a, b) => b.over90 - a.over90 || b.units - a.units);
  const max = Math.max(...rows.map((r) => r.units));
  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-[0.78rem] text-muted">
        {["b0", "b1", "b2", "b3"].map((b, i) => (
          <span key={b} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-[3px]" style={{ background: AGING_COLORS[i] }} />
            {t(`bucket.${b}`)}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-[0.42rem]">
        {rows.map((r, idx) => (
          <div key={r.store} className="grid grid-cols-[6.3rem_1fr_2.4rem] items-center gap-3">
            <div className="text-[0.88rem] text-navy truncate">{storeName(r.store)}</div>
            <div className="flex h-[1.2rem] rounded-[4px] overflow-hidden anim-grow" style={{ width: `${(r.units / max) * 100}%`, animationDelay: `${120 + idx * 35}ms` }} title={`${r.units}`}>
              {r.buckets.map((n, i) => (
                <div
                  key={i}
                  className="h-full flex items-center justify-center text-[0.7rem] font-semibold tnum"
                  style={{ width: `${(n / r.units) * 100}%`, background: AGING_COLORS[i], color: palette.navy, boxShadow: i ? `inset 1px 0 0 ${palette.surface}` : undefined }}
                >
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
