"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/state/AppState";
import { agingColorForShare, AGING_COLORS } from "./ui";

const VB_W = 1000;
const CENTER = { lat: 19.43, lng: -99.17 };
const POWER = 0.36;
/** Small manual nudges (in projected units) to keep labels apart. Geography stays approximate. */
const NUDGE: Record<string, { x: number; y: number }> = { TOL: { x: -0.9, y: 0.1 }, SFE: { x: -0.1, y: -0.25 }, COY: { x: 0.25, y: -0.15 } }; // radial compression so the metro area is readable next to the regional stores

function project(lat: number, lng: number) {
  const dx = (lng - CENTER.lng) * Math.cos((lat * Math.PI) / 180) * 111;
  const dy = (lat - CENTER.lat) * 111;
  const r = Math.hypot(dx, dy);
  const k = r > 0 ? Math.pow(r, POWER) / r : 0;
  return { x: dx * k, y: -dy * k };
}

interface RouteArc {
  from: string;
  to: string;
  approved: number;
  proposed: number;
}

export function NetworkMap({ height }: { height?: number }) {
  const { world, kpis, engine, statusOf, t, f, storeName, brandName } = useApp();
  const [hover, setHover] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [VB_H, setVbH] = useState(560);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setVbH(Math.round((VB_W * r.height) / r.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const raw = world.stores.map((s) => {
      const p = project(s.lat, s.lng);
      const n = NUDGE[s.id] ?? { x: 0, y: 0 };
      return { id: s.id, x: p.x + n.x, y: p.y - n.y };
    });
    const xs = raw.map((p) => p.x);
    const ys = raw.map((p) => p.y);
    const pad = { l: 90, r: 130, t: 105, b: 62 };
    const sx = (VB_W - pad.l - pad.r) / (Math.max(...xs) - Math.min(...xs));
    const sy = (VB_H - pad.t - pad.b) / (Math.max(...ys) - Math.min(...ys));
    // Stylized: allow a mild horizontal stretch so the network fills a wide panel.
    const s = Math.min(sy, sx);
    const kx = Math.min(sx, s * 1.3);
    const ox = pad.l + (VB_W - pad.l - pad.r - kx * (Math.max(...xs) - Math.min(...xs))) / 2;
    const oy = pad.t + (VB_H - pad.t - pad.b - s * (Math.max(...ys) - Math.min(...ys))) / 2;
    const pos: Record<string, { x: number; y: number }> = {};
    const r1 = (v: number) => Math.round(v * 10) / 10;
    raw.forEach((p) => (pos[p.id] = { x: r1(ox + (p.x - Math.min(...xs)) * kx), y: r1(oy + (p.y - Math.min(...ys)) * s) }));
    const metro = ["POL", "SFE", "COY", "SAT", "ECA"].map((id) => pos[id]);
    const mx = metro.reduce((a, p) => a + p.x, 0) / metro.length;
    const my = metro.reduce((a, p) => a + p.y, 0) / metro.length;
    const mr = Math.max(...metro.map((p) => Math.hypot(p.x - mx, p.y - my))) + 46;
    return { pos, metro: { x: r1(mx), y: r1(my), r: r1(mr) } };
  }, [world, VB_H]);

  const maxUnits = Math.max(...kpis.stores.map((s) => s.units));
  const radius = (n: number) => Math.round((11 + 19 * Math.sqrt(n / maxUnits)) * 10) / 10;

  const arcs = useMemo(() => {
    const m = new Map<string, RouteArc>();
    for (const a of engine.result.actions) {
      if (a.type !== "transfer") continue;
      const st = statusOf(a.id);
      if (st === "rejected") continue;
      const k = `${a.from}>${a.to}`;
      const r = m.get(k) ?? { from: a.from, to: a.to!, approved: 0, proposed: 0 };
      if (st === "approved") r.approved++;
      else r.proposed++;
      m.set(k, r);
    }
    return [...m.values()];
  }, [engine, statusOf]);

  const flows = useMemo(() => {
    const out: Record<string, { in: number; out: number }> = {};
    for (const s of world.stores) out[s.id] = { in: 0, out: 0 };
    for (const a of arcs) {
      out[a.from].out += a.approved + a.proposed;
      out[a.to].in += a.approved + a.proposed;
    }
    return out;
  }, [arcs, world]);

  const statsBy = Object.fromEntries(kpis.stores.map((s) => [s.store, s]));

  function arcPath(a: RouteArc, bend: number) {
    const p = layout.pos[a.from];
    const q = layout.pos[a.to];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    const cx = (p.x + q.x) / 2 + nx * len * bend;
    const cy = (p.y + q.y) / 2 + ny * len * bend;
    // Trim ends to node edges (approximate along the control direction).
    const r0 = radius(statsBy[a.from].units) + 4;
    const r1 = radius(statsBy[a.to].units) + 9;
    const s0 = trim(p, { x: cx, y: cy }, r0);
    const s1 = trim(q, { x: cx, y: cy }, r1);
    return `M ${s0.x.toFixed(1)} ${s0.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${s1.x.toFixed(1)} ${s1.y.toFixed(1)}`;
  }
  const width = (n: number) => 1.2 + 1.5 * Math.sqrt(n);

  const hovered = hover ? statsBy[hover] : null;
  const hs = hover ? world.stores.find((s) => s.id === hover)! : null;

  // Label placement: right of the node unless near the right edge or crowded.
  const labelSide: Record<string, "r" | "l" | "b" | "t"> = { POL: "r", SFE: "b", COY: "r", SAT: "l", ECA: "r", TOL: "b", PUE: "b", QRO: "r", PAC: "r", LEO: "b" };

  return (
    <div ref={boxRef} className="relative w-full h-full" style={height ? { height } : undefined}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label={t("overview.mapTitle")}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#0fa3a3" />
          </marker>
          <marker id="arrowA" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#0a7676" />
          </marker>
        </defs>
        <circle cx={layout.metro.x} cy={layout.metro.y} r={layout.metro.r} fill="#eef3f7" stroke="#d3dce6" strokeDasharray="3 4" />
        <text x={layout.metro.x} y={layout.metro.y - layout.metro.r - 8} textAnchor="middle" fontSize="14" fill="#8794a3">
          {t("overview.metro")}
        </text>
        {arcs.map((a) => (
          <g key={`${a.from}-${a.to}`}>
            {a.proposed > 0 && (
              <path d={arcPath(a, 0.18)} fill="none" stroke="#0fa3a3" strokeOpacity={0.8} strokeWidth={width(a.proposed)} strokeDasharray="6 5" strokeLinecap="round" markerEnd="url(#arrow)" />
            )}
            {a.approved > 0 && (
              <path d={arcPath(a, a.proposed > 0 ? 0.3 : 0.18)} fill="none" stroke="#0a7676" strokeWidth={width(a.approved)} strokeLinecap="round" markerEnd="url(#arrowA)" />
            )}
          </g>
        ))}
        {world.stores.map((s) => {
          const p = layout.pos[s.id];
          const st = statsBy[s.id];
          const r = radius(st.units);
          const side = labelSide[s.id] ?? "r";
          const lx = side === "r" ? p.x + r + 10 : side === "l" ? p.x - r - 10 : p.x;
          const ly = side === "b" ? p.y + r + 20 : side === "t" ? p.y - r - 26 : p.y - 2;
          const anchor = side === "r" ? "start" : side === "l" ? "end" : "middle";
          return (
            <g key={s.id} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }}>
              <circle cx={p.x} cy={p.y} r={r} fill="#ffffff" stroke={agingColorForShare(st.over90Share)} strokeWidth={7} />
              <circle cx={p.x} cy={p.y} r={r + 4.5} fill="none" stroke={hover === s.id ? "#0b1f3a" : "transparent"} strokeWidth={1.5} />
              <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="16" fontWeight={600} fill="#16202b" className="tnum">
                {st.units}
              </text>
              <text x={lx} y={ly} textAnchor={anchor} fontSize="17" fontWeight={600} fill="#16202b" stroke="#ffffff" strokeWidth={4} paintOrder="stroke">
                {storeName(s.id)}
              </text>
              <text x={lx} y={ly + 18} textAnchor={anchor} fontSize="14" fill="#586777" className="tnum" stroke="#ffffff" strokeWidth={4} paintOrder="stroke">
                {t("overview.nodeOver90", { pct: f.pct(st.over90Share) })}
              </text>
            </g>
          );
        })}
      </svg>
      {hovered && hs && (
        <div
          className="absolute pointer-events-none bg-white border border-line shadow-md rounded px-3 py-2 text-[0.82rem] min-w-[220px] z-10"
          style={{ left: `${(layout.pos[hs.id].x / VB_W) * 100}%`, top: `${(layout.pos[hs.id].y / VB_H) * 100}%`, transform: "translate(-50%, calc(-100% - 40px))" }}
        >
          <div className="font-semibold text-ink text-[0.9rem]">
            {hs.name} <span className="font-normal text-muted">{hs.region}</span>
          </div>
          <div className="text-muted mb-1">{t(`tier.${hs.tier}`)}</div>
          <div className="tnum">{t("tooltip.units", { n: hovered.units })}</div>
          <div className="tnum">{t("tooltip.over90", { n: hovered.over90, pct: f.pct(hovered.over90Share) })}</div>
          <div className="tnum">{t("tooltip.avgDays", { n: f.int(hovered.avgDays) })}</div>
          <div className="tnum">{t("tooltip.floorplan", { value: f.money(hovered.monthlyFloorplan) })}</div>
          <div className="tnum">{t("tooltip.flows", { in: flows[hs.id].in, out: flows[hs.id].out })}</div>
          <div className="text-muted mt-1">{t("tooltip.brands", { list: hs.brands.map(brandName).join(", ") })}</div>
        </div>
      )}
    </div>
  );
}

function trim(from: { x: number; y: number }, toward: { x: number; y: number }, d: number) {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / l) * d, y: from.y + (dy / l) * d };
}

export function MapLegend() {
  const { t } = useApp();
  const shares = ["<10%", "10-20%", "20-30%", "30%+"];
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[0.8rem] text-muted">
      <span>{t("overview.legendSize")}</span>
      <span className="flex items-center gap-1.5">
        {t("overview.legendRing")}
        {AGING_COLORS.map((c, i) => (
          <span key={c} className="flex items-center gap-1 ml-1.5">
            <span className="inline-block w-3 h-3 rounded-full border-[3px]" style={{ borderColor: c }} />
            <span className="tnum">{shares[i]}</span>
          </span>
        ))}
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="28" height="8">
          <line x1="1" y1="4" x2="27" y2="4" stroke="#0fa3a3" strokeWidth="2.5" strokeDasharray="6 4" />
        </svg>
        {t("overview.legendProposed")}
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="28" height="8">
          <line x1="1" y1="4" x2="27" y2="4" stroke="#0a7676" strokeWidth="3" />
        </svg>
        {t("overview.legendApproved")}
      </span>
      <span>{t("overview.legendWidth")}</span>
    </div>
  );
}
