/**
 * Pure mapping between the app's kitchen data and the Supabase rows, plus the diff that turns
 * a local change into an outbox of row operations. No network code here, so it is unit-testable.
 */
import { CATALOG, aisleOf } from "./catalog";
import { categoryOf, statusOf, unitOf } from "./units";
import type { Batch, Category, CookEntry, FridgeItem, KitchenData, ListItem, Region, Unit } from "./types";

export type Table = "kitchen_inventory" | "inventory_batches" | "shopping_list" | "cook_log";
export interface Op {
  table: Table;
  kind: "upsert" | "delete" | "bought";
  id: string;
  row?: Record<string, unknown>;
}

/** slug <-> ingredients.id (uuid), loaded once from the catalogue table. */
export interface IdMap {
  toUuid: Record<string, string>;
  toSlug: Record<string, string>;
}

export function inventoryRow(it: FridgeItem, householdId: string, ids: IdMap) {
  return {
    id: it.id,
    household_id: householdId,
    ingredient_id: it.cid ? ids.toUuid[it.cid] ?? null : null,
    custom_name: it.cid && ids.toUuid[it.cid] ? null : it.name || (it.cid ? CATALOG[it.cid]?.en : null) || "Item",
    custom_name_en: it.cid ? null : it.en ?? null,
    custom_name_th: it.cid ? null : it.th ?? null,
    custom_category: it.cid ? null : it.cat ?? "pantry",
    quantity: it.qty,
    unit: unitOf(it),
    full_quantity: it.full,
    status: statusOf(it),
  };
}

export const batchRow = (b: Batch, inventoryId: string, householdId: string) => ({
  id: b.id,
  household_id: householdId,
  inventory_id: inventoryId,
  quantity: b.qty,
  purchased_on: b.purchased,
  use_by: b.useBy ?? null,
  best_before: b.bestBefore ?? null,
  estimated: !!b.est,
});

export function listRow(it: ListItem, householdId: string, ids: IdMap, region: Region) {
  const c = it.cid ? CATALOG[it.cid] : undefined;
  const cat = categoryOf(it);
  return {
    id: it.id,
    household_id: householdId,
    ingredient_id: it.cid ? ids.toUuid[it.cid] ?? null : null,
    ingredient_name: c ? c.en : it.en || it.name || "Item",
    ingredient_name_th: c ? c.th : it.th ?? null,
    category: cat,
    aisle_category: aisleOf(cat, region),
    quantity: it.qty,
    unit: unitOf(it),
    is_bought: false,
    added_from_recipe: it.from ?? null,
  };
}

export const logRow = (e: CookEntry, householdId: string) => ({
  id: e.id,
  household_id: householdId,
  recipe_title: e.title,
  saved_thb: e.thb,
  saved_gbp: e.gbp,
  cooked_at: new Date(e.at).toISOString(),
});

type Row = Record<string, any>;
const num = (v: unknown) => (typeof v === "number" ? v : parseFloat(String(v ?? 0))) || 0;
const time = (v: unknown) => (v ? Date.parse(String(v)) : Date.now());

function unitField(cid: string | undefined, unit: string): { u?: Unit } {
  if (cid && CATALOG[cid] && CATALOG[cid].u === unit) return {};
  return { u: unit as Unit };
}

export function batchFromRow(r: Row): Batch {
  const b: Batch = { id: r.id, qty: num(r.quantity), purchased: String(r.purchased_on).slice(0, 10) };
  if (r.use_by) b.useBy = String(r.use_by).slice(0, 10);
  if (r.best_before) b.bestBefore = String(r.best_before).slice(0, 10);
  if (r.estimated) b.est = true;
  return b;
}

/** A fridge item from its row plus its purchase rows (`batchRows` already filtered to this item). */
export function itemFromRow(r: Row, ids: IdMap, batchRows?: Row[]): FridgeItem {
  const cid = r.ingredient_id ? ids.toSlug[r.ingredient_id] : undefined;
  const base = cid
    ? { cid }
    : { name: r.custom_name as string, en: r.custom_name_en ?? undefined, th: r.custom_name_th ?? undefined, cat: (r.custom_category ?? "pantry") as Category };
  let qty = num(r.quantity);
  const item: FridgeItem = { id: r.id, ...base, ...unitField(cid, r.unit), qty, full: 0, updatedAt: time(r.updated_at) };
  if (batchRows && (batchRows.length || qty <= 0)) {
    item.batches = batchRows.map(batchFromRow).filter((b) => b.qty > 0).sort((a, b) => a.purchased.localeCompare(b.purchased));
    qty = Math.round(item.batches.reduce((s, b) => s + b.qty, 0) * 100) / 100;
    item.qty = qty;
  }
  item.full = Math.max(num(r.full_quantity), qty);
  return item;
}

export function listFromRow(r: Row, ids: IdMap): ListItem {
  const cid = r.ingredient_id ? ids.toSlug[r.ingredient_id] : undefined;
  const base = cid
    ? { cid }
    : { name: r.ingredient_name as string, en: r.ingredient_name as string, th: r.ingredient_name_th ?? undefined, cat: (r.category ?? "pantry") as Category };
  const it: ListItem = { id: r.id, ...base, ...unitField(cid, r.unit), qty: num(r.quantity), updatedAt: time(r.updated_at ?? r.created_at) };
  if (r.added_from_recipe) it.from = r.added_from_recipe;
  return it;
}

export const logFromRow = (r: Row): CookEntry => ({
  id: r.id,
  title: r.recipe_title,
  thb: num(r.saved_thb),
  gbp: num(r.saved_gbp),
  at: time(r.cooked_at),
});

/** Compare two versions of the kitchen and produce the row operations that take the server from one to the other. */
export function diffKitchen(prev: KitchenData, next: KitchenData, boughtIds: Set<string>, householdId: string, ids: IdMap, region: Region): Op[] {
  const ops: Op[] = [];
  const pass = <T extends { id: string }>(table: Table, a: T[], b: T[], toRow: (x: T) => Record<string, unknown>) => {
    const before = new Map(a.map((x) => [x.id, x]));
    const after = new Map(b.map((x) => [x.id, x]));
    for (const [id, x] of after) {
      const old = before.get(id);
      if (!old || JSON.stringify(old) !== JSON.stringify(x)) ops.push({ table, kind: "upsert", id, row: toRow(x) });
    }
    for (const id of before.keys()) {
      if (!after.has(id)) ops.push({ table, kind: table === "shopping_list" && boughtIds.has(id) ? "bought" : "delete", id });
    }
  };
  pass("kitchen_inventory", prev.items, next.items, (x) => inventoryRow(x, householdId, ids));
  type Flat = Batch & { inv: string };
  const flat = (d: KitchenData): Flat[] => d.items.flatMap((i) => (i.batches ?? []).map((b) => ({ ...b, inv: i.id })));
  pass<Flat>("inventory_batches", flat(prev), flat(next), (x) => {
    const { inv, ...b } = x;
    return batchRow(b, inv, householdId);
  });
  pass("shopping_list", prev.list, next.list, (x) => listRow(x, householdId, ids, region));
  pass("cook_log", prev.log, next.log, (x) => logRow(x, householdId));
  return ops;
}

/** Merge new ops into the outbox so each row has at most one pending operation (the latest). */
export function mergeOutbox(outbox: Op[], ops: Op[]): Op[] {
  const out = new Map(outbox.map((o) => [`${o.table}:${o.id}`, o]));
  for (const o of ops) out.set(`${o.table}:${o.id}`, o);
  return [...out.values()];
}

