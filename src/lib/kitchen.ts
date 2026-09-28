/**
 * Pure operations on the kitchen: every function takes the current data and returns new data,
 * so the store stays thin, undo is a snapshot, and sync can diff before/after.
 * Amounts live in purchases ("batches") with their own dates; an item's qty is their total.
 */
import { CATALOG } from "./catalog";
import { addDays, todayISO } from "./dates";
import { addAmount, batchesOf, consume, discardExpired, estimateDates, makeBatch, setTotal, usableQty, withBatches } from "./expiry";
import { newId } from "./id";
import { savedFor, type MatchContext } from "./matcher";
import { convertInto, isNative, keyOf, packOf, round, statusOf, stepOf, unitOf, useOf } from "./units";
import type { Batch, BatchDates, FridgeItem, IngredientRef, KitchenData, ListItem, Parsed, RecipeCardData, Unit } from "./types";

export { newId };

const clone = (d: KitchenData): KitchenData => ({
  items: d.items.map((i) => ({ ...i, batches: i.batches?.map((b) => ({ ...b })) })),
  list: d.list.map((i) => ({ ...i })),
  log: d.log.map((i) => ({ ...i })),
});
const now = () => Date.now();
const fields = (x: IngredientRef): IngredientRef =>
  x.cid ? { cid: x.cid } : { name: x.name, en: x.en, th: x.th, cat: x.cat || "pantry" };
const catUnit = (x: IngredientRef): Unit => x.u || (x.cid && CATALOG[x.cid] ? CATALOG[x.cid].u : "pc");
const datesOf = (x: BatchDates): BatchDates | undefined =>
  x.purchased || x.useBy || x.bestBefore ? { purchased: x.purchased, useBy: x.useBy, bestBefore: x.bestBefore } : undefined;

export const findItem = (d: KitchenData, x: IngredientRef) => d.items.find((i) => keyOf(i) === keyOf(x));
export const findListed = (d: KitchenData, x: IngredientRef) => d.list.find((i) => keyOf(i) === keyOf(x));

/** Replace one fridge item in place (keeping its position). */
function put(d: KitchenData, item: FridgeItem) {
  const i = d.items.findIndex((x) => x.id === item.id);
  item.updatedAt = now();
  if (i >= 0) d.items[i] = item;
  else d.items.push(item);
  return item;
}

/* ---------- fridge ---------- */
export interface AddOptions {
  restock?: boolean;
  today?: string;
  /** Dates for this purchase (override anything parsed from text). */
  dates?: BatchDates;
}

/** Add stock. Every addition with an amount is a new purchase with its own dates (given or estimated). */
export function addToFridge(data: KitchenData, x: Parsed, opts: AddOptions = {}) {
  const today = opts.today ?? todayISO();
  const d = clone(data);
  const dates = opts.dates ?? datesOf(x);
  let item = findItem(d, x);
  const incoming = typeof x.qty === "number" ? x.qty : null;

  if (item) {
    let add: number | null = null;
    if (incoming != null) add = convertInto(item, incoming, catUnit(x)) ?? packOf(item);
    else if ((item.qty || 0) <= 0) add = packOf(item);
    if (add != null) item = addAmount(item, add, today, dates ?? {}, true);
    else if (dates) {
      // Dates given for something already in stock (e.g. "milk use by 3/10"): date the newest purchase.
      const bs = batchesOf(item, today);
      if (bs.length) {
        const target = [...bs].sort((a, b) => b.purchased.localeCompare(a.purchased))[0];
        item = withBatches(item, bs.map((b) => (b === target ? redate(item!.cid, b, clean(dates)) : b)));
      }
    }
    item.full = opts.restock ? item.qty : Math.max(item.full || 0, item.qty);
    put(d, item);
  } else {
    const base = { id: newId(), ...fields(x), qty: 0, full: 0, updatedAt: now() } as FridgeItem;
    if (x.u && (!x.cid || x.u !== CATALOG[x.cid]?.u)) base.u = x.u;
    const qty = incoming ?? packOf(base);
    item = withBatches(base, [makeBatch(x.cid, qty, today, dates)]);
    item.full = Math.max(item.qty, isNative(item) ? CATALOG[item.cid!].pack : item.qty);
    put(d, item);
  }
  // Having it means it no longer needs buying.
  const listed = findListed(d, x);
  if (listed) d.list = d.list.filter((l) => l !== listed);
  return { data: d, item };
}

/**
 * Apply dates the cook typed to a purchase. Estimated dates are guesses, so any the cook gives replace
 * them all (an estimated best-before must not survive next to a real use-by); a new purchase date on an
 * estimated purchase moves the estimate with it. Dates the cook entered earlier are kept.
 */
export function redate(cid: string | undefined, b: Batch, patch: Partial<Omit<Batch, "id">>): Batch {
  const touchesExpiry = "useBy" in patch || "bestBefore" in patch;
  const guessed = b.est || (!b.useBy && !b.bestBefore);
  const base: Batch = { ...b };
  if (b.est && touchesExpiry) {
    delete base.useBy;
    delete base.bestBefore;
  }
  const next: Batch = { ...base, ...patch };
  for (const k of ["useBy", "bestBefore"] as const) if (!next[k]) delete next[k];
  delete next.est;
  if (touchesExpiry) return next;
  if (patch.purchased && guessed) {
    delete next.useBy;
    delete next.bestBefore;
    return { ...next, ...estimateDates(cid, next.purchased) };
  }
  return b.est ? { ...next, est: true } : next;
}

function clean(dates: BatchDates): BatchDates {
  const out: BatchDates = {};
  if (dates.purchased) out.purchased = dates.purchased;
  if (dates.useBy) out.useBy = dates.useBy;
  if (dates.bestBefore) out.bestBefore = dates.bestBefore;
  return out;
}

/* ---------- shopping list ---------- */
export type ListResult = "ok" | "dup" | "onlist";

export function addToList(data: KitchenData, x: Parsed, opts: { from?: string; force?: boolean } = {}) {
  const d = clone(data);
  const stocked = findItem(d, x);
  if (!opts.force && stocked && statusOf(stocked) === "IN_STOCK") return { data, result: "dup" as ListResult };
  const listed = findListed(d, x);
  if (listed) {
    if (typeof x.qty !== "number") return { data, result: "onlist" as ListResult };
    const add = convertInto(listed, x.qty, catUnit(x));
    if (add != null) listed.qty = round(listed.qty + add);
    listed.updatedAt = now();
    return { data: d, result: "ok" as ListResult, item: listed };
  }
  const item = { id: newId(), ...fields(x), qty: 0, updatedAt: now() } as ListItem;
  if (opts.from) item.from = opts.from;
  const srcU = x.u || stocked?.u;
  if (srcU && (!x.cid || srcU !== CATALOG[x.cid]?.u)) item.u = srcU;
  item.qty = typeof x.qty === "number" ? x.qty : stocked && !isNative(stocked) ? stocked.full || 1 : packOf(item);
  d.list.push(item);
  return { data: d, result: "ok" as ListResult, item };
}

/** Ticking an item as bought records a new purchase (bought today, dates estimated) in the fridge. */
export function markBought(data: KitchenData, listId: string, today = todayISO()) {
  const li = data.list.find((i) => i.id === listId);
  if (!li) return { data, item: undefined };
  const without = { ...data, list: data.list.filter((i) => i.id !== listId) };
  const r = addToFridge(without, { ...li, qty: li.qty, u: unitOf(li) }, { restock: true, today, dates: { purchased: today } });
  return { data: r.data, item: li };
}

/* ---------- amounts ---------- */
type Where = "fridge" | "list";

function finishIfEmpty(d: KitchenData, item: FridgeItem) {
  if (item.qty > 0) return { data: d, wentOut: undefined as FridgeItem | undefined };
  const r = addToList(d, item, { force: true });
  return { data: r.data, wentOut: item };
}

/** The − / + buttons: move to the next multiple of a sensible step (1 egg, 100 g, 250 ml…). */
export function stepQty(data: KitchenData, where: Where, id: string, dir: 1 | -1, today = todayISO()) {
  const d = clone(data);
  if (where === "list") {
    const it = d.list.find((i) => i.id === id);
    if (!it) return { data, wentOut: undefined };
    const s = stepOf(it);
    const next = dir > 0 ? Math.floor((it.qty + 1e-9) / s) * s + s : Math.ceil((it.qty - 1e-9) / s) * s - s;
    it.qty = round(Math.max(s, next));
    it.updatedAt = now();
    return { data: d, wentOut: undefined };
  }
  const it = d.items.find((i) => i.id === id);
  if (!it) return { data, wentOut: undefined };
  const s = stepOf(it);
  const wasOut = (it.qty || 0) <= 0;
  let next = dir > 0 ? Math.floor((it.qty + 1e-9) / s) * s + s : Math.ceil((it.qty - 1e-9) / s) * s - s;
  next = round(Math.max(0, next));
  // Going up from empty is a new purchase today; otherwise adjust existing purchases.
  const updated = wasOut && next > 0 ? addAmount(it, next, today, { purchased: today }, true) : setTotal(it, next, today);
  updated.full = wasOut && next > 0 ? Math.max(next, packOf(updated)) : Math.max(it.full || 0, updated.qty);
  put(d, updated);
  return finishIfEmpty(d, updated);
}

export function setQty(data: KitchenData, where: Where, id: string, qty: number, today = todayISO()) {
  if (!(qty >= 0)) return { data, wentOut: undefined };
  const d = clone(data);
  if (where === "list") {
    const it = d.list.find((i) => i.id === id);
    if (!it) return { data, wentOut: undefined };
    it.qty = round(qty) > 0 ? round(qty) : stepOf(it);
    it.updatedAt = now();
    return { data: d, wentOut: undefined };
  }
  const it = d.items.find((i) => i.id === id);
  if (!it) return { data, wentOut: undefined };
  const updated = setTotal(it, round(qty), today);
  updated.full = Math.max(it.full || 0, updated.qty);
  put(d, updated);
  return finishIfEmpty(d, updated);
}

/** "Use up": finished it — set to 0 and put it on the shopping list. */
export function useUp(data: KitchenData, id: string) {
  const d = clone(data);
  const it = d.items.find((i) => i.id === id);
  if (!it) return { data, wentOut: undefined };
  const updated = withBatches(it, []);
  put(d, updated);
  return finishIfEmpty(d, updated);
}

export const removeItem = (data: KitchenData, id: string): KitchenData => ({ ...data, items: data.items.filter((i) => i.id !== id) });
export const removeListItem = (data: KitchenData, id: string): KitchenData => ({ ...data, list: data.list.filter((i) => i.id !== id) });

/* ---------- purchases (batch editor) ---------- */
export function updateBatch(data: KitchenData, itemId: string, batchId: string, patch: Partial<Omit<Batch, "id">>, today = todayISO()) {
  const d = clone(data);
  const it = d.items.find((i) => i.id === itemId);
  if (!it) return { data, wentOut: undefined };
  const bs = batchesOf(it, today).map((b) => (b.id === batchId ? redate(it.cid, b, patch) : b));
  const updated = withBatches(it, bs);
  updated.full = Math.max(it.full || 0, updated.qty);
  put(d, updated);
  return finishIfEmpty(d, updated);
}

export function addBatch(data: KitchenData, itemId: string, qty: number, dates: BatchDates, today = todayISO()) {
  const d = clone(data);
  const it = d.items.find((i) => i.id === itemId);
  if (!it || !(qty > 0)) return { data };
  const updated = addAmount(it, qty, today, dates, true);
  updated.full = Math.max(updated.qty, it.full || 0);
  put(d, updated);
  const listed = findListed(d, it);
  if (listed) d.list = d.list.filter((l) => l !== listed);
  return { data: d };
}

export function removeBatch(data: KitchenData, itemId: string, batchId: string, today = todayISO()) {
  const d = clone(data);
  const it = d.items.find((i) => i.id === itemId);
  if (!it) return { data, wentOut: undefined };
  const updated = withBatches(it, batchesOf(it, today).filter((b) => b.id !== batchId));
  put(d, updated);
  return finishIfEmpty(d, updated);
}

/** Throw away whatever is past its use-by date. */
export function throwAwayExpired(data: KitchenData, itemId: string, today = todayISO()) {
  const d = clone(data);
  const it = d.items.find((i) => i.id === itemId);
  if (!it) return { data, wentOut: undefined, discarded: 0 };
  const r = discardExpired(it, today);
  put(d, r.item);
  return { ...finishIfEmpty(d, r.item), discarded: r.discarded };
}

/* ---------- cooking ---------- */
/** Take each ingredient's portion out of the fridge (soonest-expiring first), list what runs out, log the saving. */
export function cook(data: KitchenData, card: RecipeCardData, ctx: Omit<MatchContext, "items">, title: string, today = todayISO()) {
  let d = clone(data);
  const saved = card.saved ?? savedFor({ ...ctx, items: d.items }, card.uses || []);
  const outs: FridgeItem[] = [];
  for (const u of card.uses || []) {
    const it = u.itemId ? d.items.find((i) => i.id === u.itemId) : u.cid ? d.items.find((i) => i.cid === u.cid) : undefined;
    const usable = it ? usableQty(it, today) : 0;
    if (!it || usable <= 0) continue;
    const take = Math.min(usable, typeof u.amount === "number" ? u.amount : useOf(it));
    const updated = put(d, consume(it, take, today, true));
    if (updated.qty <= 0) outs.push(updated);
  }
  for (const it of outs) d = addToList(d, it, { from: title, force: true }).data;
  d.log.push({ id: newId(), title, thb: saved.thb, gbp: saved.gbp, at: now() });
  return { data: d, outs };
}

export function totals(data: KitchenData) {
  return data.log.reduce((t, e) => ({ thb: t.thb + e.thb, gbp: round(t.gbp + e.gbp), meals: t.meals + 1 }), { thb: 0, gbp: 0, meals: 0 });
}

/** Give dates to items saved before dates existed (one undated purchase holding the amount). */
export function upgradeData(data: KitchenData, today = todayISO()): KitchenData {
  if (data.items.every((i) => i.batches)) return data;
  return { ...data, items: data.items.map((i) => (i.batches ? i : withBatches(i, batchesOf(i, today)))) };
}

/* ---------- sample data for first run ---------- */
export function sampleKitchen(today = todayISO()): KitchenData {
  const t = now();
  // Bought a few days ago so the expiry features have something to show.
  const rows: [string, number, number][] = [
    ["pork_mince", 500, -1], ["thai_basil", 1, -3], ["egg", 2, -12], ["rice", 2000, -30], ["garlic", 8, -10], ["chilli", 10, -5],
    ["spinach", 150, -3], ["cheese", 200, -6], ["pasta", 500, -40], ["onion", 3, -7], ["potato", 6, -9], ["milk", 0, -8],
  ];
  const items: FridgeItem[] = rows.map(([cid, qty, ago]) => {
    const base: FridgeItem = { id: newId(), cid, qty: 0, full: Math.max(qty, CATALOG[cid].pack), updatedAt: t };
    return withBatches(base, qty > 0 ? [makeBatch(cid, qty, today, { purchased: addDays(today, ago) })] : []);
  });
  const list: ListItem[] = [
    { id: newId(), cid: "milk", qty: 1000, updatedAt: t },
    { id: newId(), cid: "lime", qty: 4, updatedAt: t },
  ];
  return { items, list, log: [] };
}
