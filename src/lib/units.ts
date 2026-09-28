import { CATALOG } from "./catalog";
import type { Category, IngredientRef, Lang, Status, Unit } from "./types";

type UnitDef = { kind: "mass" | "vol" } | { kind: "count"; en: [string, string]; th: string };

export const UNITS: Record<Unit, UnitDef> = {
  g: { kind: "mass" },
  ml: { kind: "vol" },
  egg: { kind: "count", en: ["egg", "eggs"], th: "ฟอง" },
  clove: { kind: "count", en: ["clove", "cloves"], th: "กลีบ" },
  tuber: { kind: "count", en: ["pc", "pcs"], th: "หัว" },
  fruit: { kind: "count", en: ["pc", "pcs"], th: "ลูก" },
  head: { kind: "count", en: ["head", "heads"], th: "หัว" },
  bunch: { kind: "count", en: ["bunch", "bunches"], th: "กำ" },
  stalk: { kind: "count", en: ["stalk", "stalks"], th: "ต้น" },
  leaf: { kind: "count", en: ["leaf", "leaves"], th: "ใบ" },
  slice: { kind: "count", en: ["slice", "slices"], th: "แผ่น" },
  tin: { kind: "count", en: ["tin", "tins"], th: "กระป๋อง" },
  cube: { kind: "count", en: ["cube", "cubes"], th: "ก้อน" },
  block: { kind: "count", en: ["block", "blocks"], th: "ก้อน" },
  pc: { kind: "count", en: ["pc", "pcs"], th: "ชิ้น" },
};

export const kindOf = (u: Unit) => UNITS[u]?.kind ?? "count";
export const round = (n: number) => Math.round(n * 100) / 100;

/* ---------- naming ---------- */
export const keyOf = (x: IngredientRef) => x.cid || "~" + (x.name || "").toLowerCase();
export function nameOf(x: IngredientRef, lang: Lang): string {
  const c = x.cid ? CATALOG[x.cid] : undefined;
  if (c) return c[lang];
  return (lang === "th" ? x.th || x.name : x.en || x.name) || "";
}
export function altNameOf(x: IngredientRef, lang: Lang): string {
  const other: Lang = lang === "th" ? "en" : "th";
  const c = x.cid ? CATALOG[x.cid] : undefined;
  if (c) return c[other];
  const v = x[other];
  return v && v !== nameOf(x, lang) ? v : "";
}
export const categoryOf = (x: IngredientRef): Category => (x.cid && CATALOG[x.cid] ? CATALOG[x.cid].cat : x.cat || "pantry");

/* ---------- amounts ---------- */
type Amounted = IngredientRef & { qty?: number; full?: number };

export const unitOf = (x: IngredientRef): Unit => x.u || (x.cid && CATALOG[x.cid] ? CATALOG[x.cid].u : "pc");
/** True when the item is tracked in the catalogue's own unit (so pack/portion sizes apply). */
export const isNative = (x: IngredientRef) => !!(x.cid && CATALOG[x.cid] && unitOf(x) === CATALOG[x.cid].u);
export const packOf = (x: Amounted): number => (isNative(x) ? CATALOG[x.cid!].pack : x.full || x.qty || 1);
export function stepOf(x: Amounted): number {
  const u = unitOf(x);
  if (kindOf(u) === "count") return isNative(x) && CATALOG[x.cid!].use < 1 ? 0.5 : 1;
  const base = isNative(x) ? CATALOG[x.cid!].pack : x.full || 100;
  return [500, 250, 100, 50, 25, 10, 5].find((s) => s <= base / 4) ?? 5;
}
export const useOf = (x: Amounted): number => (isNative(x) ? CATALOG[x.cid!].use : Math.max(stepOf(x), packOf(x) * 0.3));
/** "Running low" once about one meal's worth (or a quarter of the last restock) is left. */
export const lowAt = (x: Amounted) => Math.max(useOf(x), (x.full || packOf(x)) * 0.25);
export function statusOf(x: Amounted): Status {
  const q = x.qty || 0;
  if (q <= 0) return "OUT_OF_STOCK";
  return q <= lowAt(x) + 1e-9 ? "RUNNING_LOW" : "IN_STOCK";
}

export const numTxt = (n: number) => {
  const r = round(n);
  return Number.isInteger(r) ? String(r) : String(r).replace(/\.?0+$/, "");
};

/** Display value and unit label for an amount (switches to kg / L from 1000). */
export function show(qty: number, u: Unit, lang: Lang): { n: number; mult: number; u: string } {
  const d = UNITS[u] ?? UNITS.pc;
  if (d.kind !== "count") {
    if (d.kind === "mass") return qty >= 1000 ? { n: qty / 1000, mult: 1000, u: lang === "th" ? "กก." : "kg" } : { n: qty, mult: 1, u: lang === "th" ? "กรัม" : "g" };
    return qty >= 1000 ? { n: qty / 1000, mult: 1000, u: lang === "th" ? "ลิตร" : "L" } : { n: qty, mult: 1, u: lang === "th" ? "มล." : "ml" };
  }
  return { n: qty, mult: 1, u: lang === "th" ? d.th : d.en[qty === 1 ? 0 : 1] };
}
export const amountText = (qty: number, u: Unit, lang: Lang) => {
  const s = show(qty, u, lang);
  return `${numTxt(s.n)} ${s.u}`;
};

/** Estimated cost of `qty` of an ingredient, from the catalogue pack price. */
export function priceOf(x: Amounted, qty: number): { thb: number; gbp: number } | null {
  if (!x.cid || !CATALOG[x.cid]) return null;
  const c = CATALOG[x.cid];
  const f = qty / packOf(x);
  return { thb: c.thb * f, gbp: c.gbp * f };
}

/** Convert an amount in unit `u` into the unit `target` is tracked in; null when they can't be compared. */
export function convertInto(target: IngredientRef, qty: number, u: Unit | undefined): number | null {
  const tu = unitOf(target);
  if (!u || u === tu) return qty;
  const tk = kindOf(tu);
  const k = kindOf(u);
  if ((tk === "mass" || tk === "vol") && (k === "mass" || k === "vol")) return qty; // g ≈ ml for kitchen purposes
  if (tk === k) return qty;
  return null;
}
