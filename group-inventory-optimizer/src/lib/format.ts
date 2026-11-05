import type { Lang } from "@/i18n";

const locale = (lang: Lang) => (lang === "es" ? "es-MX" : "en-US");
const cache = new Map<string, Intl.NumberFormat>();
function nf(lang: Lang, key: string, opts: Intl.NumberFormatOptions) {
  const k = `${lang}|${key}`;
  let f = cache.get(k);
  if (!f) {
    f = new Intl.NumberFormat(locale(lang), opts);
    cache.set(k, f);
  }
  return f;
}

export function makeFormat(lang: Lang) {
  return {
    money: (x: number) => nf(lang, "money", { style: "currency", currency: "MXN", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(Math.round(x) === 0 ? 0 : x),
    moneyCompact: (x: number) =>
      nf(lang, "moneyCompact", { style: "currency", currency: "MXN", currencyDisplay: "narrowSymbol", notation: "compact", maximumFractionDigits: 1 }).format(x),
    moneySigned: (x: number) =>
      nf(lang, "moneySigned", { style: "currency", currency: "MXN", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0, signDisplay: "exceptZero" }).format(Math.round(x)),
    int: (x: number) => nf(lang, "int", { maximumFractionDigits: 0 }).format(x),
    dec1: (x: number) => nf(lang, "dec1", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(x),
    pct: (x: number) => nf(lang, "pct", { style: "percent", maximumFractionDigits: 0 }).format(x),
    pct1: (x: number) => nf(lang, "pct1", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(x),
    pctSigned: (x: number) => nf(lang, "pctSigned", { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" }).format(x),
    date: (iso: string) =>
      new Intl.DateTimeFormat(locale(lang), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)),
    monthShort: (cal: number, year: number) =>
      new Intl.DateTimeFormat(locale(lang), { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(year, cal, 1))).replace(".", ""),
  };
}
export type Fmt = ReturnType<typeof makeFormat>;
