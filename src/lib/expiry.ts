/**
 * Purchases ("batches"), their dates, and what is about to expire.
 * Pure functions; `today` is always passed in (ISO date) so the logic is testable and time-zone safe.
 */
import { SHELF_LIFE, type DateKind } from "./catalog";
import { addDays, daysBetween, isISODate } from "./dates";
import { round } from "./units";
import { newId as newBatchId } from "./id";
import type { Batch, BatchDates, FridgeItem, Lang } from "./types";

/** Typical dates for a catalogue item bought on `purchased`. Nothing for custom items. */
export function estimateDates(cid: string | undefined, purchased: string): Pick<Batch, "useBy" | "bestBefore" | "est"> {
  const s = cid ? SHELF_LIFE[cid] : undefined;
  if (!s) return {};
  const date = addDays(purchased, s.days);
  return s.kind === "use_by" ? { useBy: date, est: true } : { bestBefore: date, est: true };
}

/** A new purchase. Given dates win; missing expiry dates are estimated. */
export function makeBatch(cid: string | undefined, qty: number, today: string, dates: BatchDates = {}): Batch {
  const purchased = isISODate(dates.purchased) ? dates.purchased : today;
  const given: Pick<Batch, "useBy" | "bestBefore"> = {};
  if (isISODate(dates.useBy)) given.useBy = dates.useBy;
  if (isISODate(dates.bestBefore)) given.bestBefore = dates.bestBefore;
  const b: Batch = { id: newBatchId(), qty: round(qty), purchased, ...(given.useBy || given.bestBefore ? given : estimateDates(cid, purchased)) };
  return b;
}

/** The date that matters for a batch: use-by if it has one, else best-before. */
export function batchExpiry(b: Batch): { date: string; kind: DateKind } | null {
  if (b.useBy) return { date: b.useBy, kind: "use_by" };
  if (b.bestBefore) return { date: b.bestBefore, kind: "best_before" };
  return null;
}

/** Batches in the order they should be used: soonest date first, then oldest purchase. */
export function fifo(batches: Batch[]): Batch[] {
  return [...batches].sort((a, b) => {
    const ea = batchExpiry(a)?.date ?? "9999-12-31";
    const eb = batchExpiry(b)?.date ?? "9999-12-31";
    return ea === eb ? a.purchased.localeCompare(b.purchased) : ea.localeCompare(eb);
  });
}

/** Items saved before dates existed get one undated batch holding their amount. */
export function batchesOf(item: FridgeItem, today: string): Batch[] {
  if (item.batches) return item.batches;
  if (!(item.qty > 0)) return [];
  return [{ id: newBatchId(), qty: item.qty, purchased: today }];
}

const sum = (bs: Batch[]) => round(bs.reduce((s, b) => s + b.qty, 0));

/** Set batches and keep the item's total in step. */
export function withBatches(item: FridgeItem, batches: Batch[]): FridgeItem {
  const kept = batches.filter((b) => b.qty > 1e-9).map((b) => ({ ...b, qty: round(b.qty) }));
  return { ...item, batches: kept, qty: sum(kept) };
}

const pastUseBy = (b: Batch, today: string) => !!b.useBy && daysBetween(today, b.useBy) < 0;

/** Amount that is still safe to cook with (excludes anything past its use-by date). */
export function usableQty(item: FridgeItem, today: string): number {
  if (!item.batches) return item.qty || 0;
  return sum(item.batches.filter((b) => !pastUseBy(b, today)));
}

/** Take `amount` out, soonest-expiring first. Cooking passes `skipExpired` so food past its use-by is never used. */
export function consume(item: FridgeItem, amount: number, today: string, skipExpired = false): FridgeItem {
  let left = amount;
  const out = fifo(batchesOf(item, today)).map((b) => {
    if (skipExpired && pastUseBy(b, today)) return b;
    const take = Math.min(b.qty, left);
    left = round(left - take);
    return { ...b, qty: round(b.qty - take) };
  });
  return withBatches(item, out);
}

/** Add `amount`: a new purchase when dates are given or the item had run out; otherwise top up the newest batch. */
export function addAmount(item: FridgeItem, amount: number, today: string, dates?: BatchDates, forceNew = false): FridgeItem {
  const current = batchesOf(item, today);
  if (forceNew || dates || !current.length) return withBatches(item, [...current, makeBatch(item.cid, amount, today, dates)]);
  const newest = [...current].sort((a, b) => b.purchased.localeCompare(a.purchased))[0];
  return withBatches(item, current.map((b) => (b === newest ? { ...b, qty: b.qty + amount } : b)));
}

/** Set the total, taking from or adding to batches as needed. */
export function setTotal(item: FridgeItem, qty: number, today: string): FridgeItem {
  const cur = item.batches ? sum(item.batches) : item.qty;
  if (qty < cur) return consume({ ...item, batches: batchesOf(item, today) }, cur - qty, today);
  if (qty > cur) return addAmount(item, qty - cur, today);
  return { ...item, batches: batchesOf(item, today) };
}

/* ---------- what's expiring ---------- */

export type ExpiryLevel = "expired" | "today" | "soon" | "past_best" | "ok";

export interface ExpiryInfo {
  date: string;
  kind: DateKind;
  days: number;
  est: boolean;
  qty: number;
  batchId: string;
  level: ExpiryLevel;
}

export function levelOf(kind: DateKind, days: number, alertDays: number): ExpiryLevel {
  if (kind === "use_by") {
    if (days < 0) return "expired";
    if (days === 0) return "today";
    return days <= alertDays ? "soon" : "ok";
  }
  if (days < 0) return "past_best";
  if (days === 0) return "today";
  return days <= alertDays ? "soon" : "ok";
}

/** The most urgent dated batch of an item, or null if nothing is dated. */
export function itemExpiry(item: FridgeItem, today: string, alertDays: number): ExpiryInfo | null {
  const first = fifo((item.batches ?? []).filter((b) => b.qty > 0)).find((b) => batchExpiry(b));
  if (!first) return null;
  const e = batchExpiry(first)!;
  const days = daysBetween(today, e.date);
  return { date: e.date, kind: e.kind, days, est: !!first.est, qty: first.qty, batchId: first.id, level: levelOf(e.kind, days, alertDays) };
}

const URGENCY: Record<ExpiryLevel, number> = { expired: 0, today: 1, soon: 2, past_best: 3, ok: 4 };

/** Items that need attention, most urgent first. */
export function expiring(items: FridgeItem[], today: string, alertDays: number) {
  return items
    .filter((i) => i.qty > 0)
    .map((item) => ({ item, info: itemExpiry(item, today, alertDays) }))
    .filter((x): x is { item: FridgeItem; info: ExpiryInfo } => !!x.info && x.info.level !== "ok")
    .sort((a, b) => URGENCY[a.info.level] - URGENCY[b.info.level] || a.info.days - b.info.days);
}

/** Remove batches past their use-by date. Returns the new item and how much was thrown away. */
export function discardExpired(item: FridgeItem, today: string): { item: FridgeItem; discarded: number } {
  const bs = batchesOf(item, today);
  const keep = bs.filter((b) => !(b.useBy && daysBetween(today, b.useBy) < 0));
  return { item: withBatches(item, keep), discarded: round(sum(bs) - sum(keep)) };
}

/* ---------- wording (shared by the UI, local notifications and the daily push) ---------- */

export function expiryPhrase(info: Pick<ExpiryInfo, "kind" | "days">, lang: Lang): string {
  const { kind, days } = info;
  const ub = kind === "use_by";
  if (lang === "th") {
    const label = ub ? "หมดอายุ" : "ควรบริโภคก่อน";
    if (days < 0) return ub ? `หมดอายุแล้ว ${-days} วัน` : `เลยวันควรบริโภคก่อน ${-days} วัน`;
    if (days === 0) return `${label}วันนี้`;
    if (days === 1) return `${label}พรุ่งนี้`;
    return `${label}ใน ${days} วัน`;
  }
  const label = ub ? "Use by" : "Best before";
  if (days < 0) return ub ? `Use-by passed ${-days} day${days === -1 ? "" : "s"} ago` : `Past best before by ${-days} day${days === -1 ? "" : "s"}`;
  if (days === 0) return `${label} today`;
  if (days === 1) return `${label} tomorrow`;
  return `${label} in ${days} days`;
}

/** A short daily summary for notifications. `entries` should already be sorted most urgent first. */
export function digest(entries: { name: string; kind: DateKind; days: number }[], lang: Lang): { title: string; body: string } | null {
  if (!entries.length) return null;
  const expired = entries.filter((e) => e.kind === "use_by" && e.days < 0).length;
  const title =
    lang === "th"
      ? expired
        ? `มี ${expired} อย่างหมดอายุแล้ว · ใช้ก่อน ${entries.length - expired} อย่าง`
        : `ของที่ควรใช้เร็ว ๆ นี้ ${entries.length} อย่าง`
      : expired
        ? `${expired} past use-by · ${entries.length - expired} to use soon`
        : `${entries.length} item${entries.length === 1 ? "" : "s"} to use soon`;
  const shown = entries.slice(0, 4).map((e) => `${e.name} (${expiryPhrase(e, lang).toLowerCase()})`);
  const more = entries.length - shown.length;
  const body = shown.join(", ") + (more > 0 ? (lang === "th" ? ` และอีก ${more} อย่าง` : ` and ${more} more`) : "");
  return { title, body };
}

/**
 * For the daily push: the most urgent dated purchase per item, filtered to what needs attention.
 * Stops nagging about an item a few days after its date (it still shows in the app).
 */
export function digestEntries(
  batches: { inventoryId: string; useBy?: string | null; bestBefore?: string | null; qty: number }[],
  today: string,
  alertDays: number,
): { inventoryId: string; kind: DateKind; days: number }[] {
  const best = new Map<string, { kind: DateKind; days: number }>();
  for (const b of batches) {
    if (!(b.qty > 0)) continue;
    const kind: DateKind | null = b.useBy ? "use_by" : b.bestBefore ? "best_before" : null;
    if (!kind) continue;
    const days = daysBetween(today, (b.useBy || b.bestBefore)!);
    const cur = best.get(b.inventoryId);
    if (!cur || days < cur.days) best.set(b.inventoryId, { kind, days });
  }
  return [...best.entries()]
    .map(([inventoryId, v]) => ({ inventoryId, ...v, level: levelOf(v.kind, v.days, alertDays) }))
    .filter((e) => e.level !== "ok" && (e.kind === "use_by" ? e.days >= -2 : e.days >= -3))
    .sort((a, b) => URGENCY[a.level] - URGENCY[b.level] || a.days - b.days)
    .map(({ inventoryId, kind, days }) => ({ inventoryId, kind, days }));
}
