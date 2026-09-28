import { describe, expect, it } from "vitest";
import { parseText } from "../parser";
import { amountText, statusOf, stepOf } from "../units";
import { pickRecipes } from "../matcher";
import { addToFridge, addToList, cook, markBought, redate, sampleKitchen, stepQty, throwAwayExpired, updateBatch, useUp } from "../kitchen";
import { addDays, formatDate, parseDate } from "../dates";
import { digest, expiring, expiryPhrase, itemExpiry } from "../expiry";
import type { KitchenData } from "../types";

const empty = (): KitchenData => ({ items: [], list: [], log: [] });

describe("parser", () => {
  it("reads mixed Thai and English with amounts", () => {
    const r = parseText("หมูสับ 300 กรัม, 6 eggs, spinach, นมสด 1 ลิตร");
    expect(r).toEqual([
      { cid: "pork_mince", qty: 300 },
      { cid: "egg", qty: 6 },
      { cid: "spinach" },
      { cid: "milk", qty: 1000 },
    ]);
  });
  it("splits Thai without commas by alias", () => {
    expect(parseText("หมูบด ไข่ นม").map((x) => x.cid)).toEqual(["pork_mince", "egg", "milk"]);
  });
  it("prefers the longest alias", () => {
    expect(parseText("coconut milk")).toEqual([{ cid: "coconut_milk" }]);
  });
  it("handles units stuck to numbers and packs", () => {
    expect(parseText("1kg chicken")).toEqual([{ cid: "chicken", qty: 1000 }]);
    expect(parseText("2 bags spinach")).toEqual([{ cid: "spinach", qty: 500 }]);
    expect(parseText("2 tins tomatoes")).toEqual([{ cid: "tinned_tomato", qty: 2 }]);
    expect(parseText("ไข่ 1 โหล")).toEqual([{ cid: "egg", qty: 12 }]);
  });
  it("switches a counted item to weight when given grams", () => {
    expect(parseText("1kg potatoes")).toEqual([{ cid: "potato", qty: 1000, u: "g" }]);
  });
  it("keeps unknown items as custom names", () => {
    expect(parseText("hummus 200g")).toEqual([{ name: "Hummus", en: "Hummus", qty: 200, u: "g" }]);
  });
});

describe("units", () => {
  it("formats with the right unit per language", () => {
    expect(amountText(1500, "g", "en")).toBe("1.5 kg");
    expect(amountText(250, "ml", "th")).toBe("250 มล.");
    expect(amountText(1, "egg", "en")).toBe("1 egg");
    expect(amountText(6, "egg", "th")).toBe("6 ฟอง");
  });
  it("derives status from amount", () => {
    expect(statusOf({ cid: "egg", qty: 0, full: 10 })).toBe("OUT_OF_STOCK");
    expect(statusOf({ cid: "egg", qty: 2, full: 10 })).toBe("RUNNING_LOW");
    expect(statusOf({ cid: "egg", qty: 6, full: 10 })).toBe("IN_STOCK");
  });
  it("uses sensible steps", () => {
    expect(stepOf({ cid: "egg" })).toBe(1);
    expect(stepOf({ cid: "chicken" })).toBe(100);
    expect(stepOf({ cid: "milk" })).toBe(250);
    expect(stepOf({ cid: "cabbage" })).toBe(0.5);
  });
});

describe("kitchen loop", () => {
  it("adds to existing stock and clears it from the list", () => {
    let d = addToList(empty(), { cid: "egg" }).data;
    d = addToFridge(d, { cid: "egg", qty: 6 }).data;
    expect(d.items[0].qty).toBe(6);
    expect(d.list).toHaveLength(0);
  });
  it("refuses to list something fully in stock unless forced", () => {
    const d = addToFridge(empty(), { cid: "rice" }).data;
    expect(addToList(d, { cid: "rice" }).result).toBe("dup");
    expect(addToList(d, { cid: "rice" }, { force: true }).result).toBe("ok");
  });
  it("moves bought items into the fridge", () => {
    let d = addToList(empty(), { cid: "milk" }).data;
    d = markBought(d, d.list[0].id).data;
    expect(d.list).toHaveLength(0);
    expect(d.items[0]).toMatchObject({ cid: "milk", qty: 1000 });
  });
  it("lists items that run out", () => {
    let d = addToFridge(empty(), { cid: "egg", qty: 1 }).data;
    const r = stepQty(d, "fridge", d.items[0].id, -1);
    expect(r.wentOut?.cid).toBe("egg");
    expect(r.data.list[0].cid).toBe("egg");
    d = addToFridge(empty(), { cid: "cheese" }).data;
    expect(useUp(d, d.items[0].id).data.list).toHaveLength(1);
  });
});

describe("matcher", () => {
  it("finds all three kinds of idea for the sample fridge", () => {
    const data = sampleKitchen();
    const cards = pickRecipes({ items: data.items, region: "uk", staples: true });
    expect(cards.map((c) => c.kind)).toEqual(["A", "B", "C"]);
    expect(cards.every((c) => !c.none)).toBe(true);
    expect(cards[1].swaps?.length).toBeGreaterThan(0);
    expect(cards[2].missing).toBeTruthy();
    const titles = new Set(cards.map((c) => c.title_en));
    expect(titles.size).toBe(3);
  });
  it("cooking takes portions out and logs the saving", () => {
    const data = sampleKitchen();
    const [a] = pickRecipes({ items: data.items, region: "uk", staples: true });
    const r = cook(data, a, { region: "uk", staples: true }, a.title_en!);
    expect(r.data.log).toHaveLength(1);
    const before = data.items.reduce((s, i) => s + i.qty, 0);
    const after = r.data.items.reduce((s, i) => s + i.qty, 0);
    expect(after).toBeLessThan(before);
  });
});

describe("sync rows", () => {
  const ids = { toUuid: { egg: "u-egg", milk: "u-milk" }, toSlug: { "u-egg": "egg", "u-milk": "milk" } };
  it("round-trips fridge and list items through database rows", async () => {
    const { inventoryRow, itemFromRow, listRow, listFromRow, batchRow } = await import("../sync-rows");
    const d = addToFridge(empty(), { cid: "egg", qty: 6, useBy: "2026-10-10" }, { today: "2026-09-27" }).data;
    const it = d.items[0];
    const row = { ...inventoryRow(it, "h1", ids), updated_at: new Date(it.updatedAt).toISOString() };
    expect(row.ingredient_id).toBe("u-egg");
    const brows = it.batches!.map((b) => batchRow(b, it.id, "h1"));
    expect(brows[0]).toMatchObject({ purchased_on: "2026-09-27", use_by: "2026-10-10", best_before: null, estimated: false });
    expect(itemFromRow(row, ids, brows)).toEqual(it);
    const custom = addToList(empty(), { name: "Hummus", en: "Hummus", qty: 200, u: "g" }).data.list[0];
    const lrow = { ...listRow(custom, "h1", ids, "uk"), updated_at: new Date(custom.updatedAt).toISOString() };
    expect(lrow.aisle_category).toBe("pantry");
    expect(listFromRow(lrow, ids)).toMatchObject({ name: "Hummus", qty: 200, u: "g" });
  });
  it("diffs a change into row operations, marking bought items", async () => {
    const { diffKitchen } = await import("../sync-rows");
    const before = addToList(empty(), { cid: "milk" }).data;
    const after = markBought(before, before.list[0].id).data;
    const ops = diffKitchen(before, after, new Set([before.list[0].id]), "h1", ids, "uk");
    expect(ops.map((o) => `${o.table}:${o.kind}`).sort()).toEqual(["inventory_batches:upsert", "kitchen_inventory:upsert", "shopping_list:bought"]);
  });
});

describe("dates", () => {
  const today = "2026-09-27";
  it("reads day-first dates in both languages", () => {
    expect(parseDate("3/10", today, true)).toBe("2026-10-03");
    expect(parseDate("30.9.2569", today, true)).toBe("2026-09-30");
    expect(parseDate("5 ต.ค.", today, true)).toBe("2026-10-05");
    expect(parseDate("12 oct", today, true)).toBe("2026-10-12");
    expect(parseDate("tomorrow", today, true)).toBe("2026-09-28");
    expect(parseDate("31/2", today, true)).toBe(null);
  });
  it("picks the right year when it is left out", () => {
    expect(parseDate("3/1", "2026-12-20", true)).toBe("2027-01-03");
    expect(parseDate("28/12", "2027-01-02", false)).toBe("2026-12-28");
  });
  it("formats short dates", () => {
    expect(formatDate("2026-10-05", "en")).toBe("5 Oct");
    expect(formatDate("2026-10-05", "th")).toBe("5 ต.ค.");
  });
});

describe("dates in text", () => {
  const today = "2026-09-27";
  it("reads use-by, best-before and purchase dates with the item", () => {
    expect(parseText("milk 1L use by 3/10", today)).toEqual([{ cid: "milk", qty: 1000, useBy: "2026-10-03" }]);
    expect(parseText("ไก่ 500 กรัม หมดอายุ 29/9", today)).toEqual([{ cid: "chicken", qty: 500, useBy: "2026-09-29" }]);
    expect(parseText("cheese bb 12 oct bought yesterday", today)).toEqual([{ cid: "cheese", bestBefore: "2026-10-12", purchased: "2026-09-26" }]);
    expect(parseText("eggs, spinach", today)).toEqual([{ cid: "egg" }, { cid: "spinach" }]);
  });
});

describe("expiry", () => {
  const today = "2026-09-27";
  it("estimates dates from typical shelf life when none are given", () => {
    const d = addToFridge(empty(), { cid: "chicken" }, { today }).data;
    expect(d.items[0].batches![0]).toMatchObject({ purchased: today, useBy: "2026-09-29", est: true });
    const r = addToFridge(empty(), { cid: "rice" }, { today }).data;
    expect(r.items[0].batches![0].bestBefore).toBe(addDays(today, 365));
  });
  it("uses the soonest-expiring purchase first", () => {
    let d = addToFridge(empty(), { cid: "milk", qty: 1000, useBy: "2026-10-05" }, { today }).data;
    d = addToFridge(d, { cid: "milk", qty: 500, useBy: "2026-09-29" }, { today }).data;
    expect(d.items[0].qty).toBe(1500);
    d = stepQty(d, "fridge", d.items[0].id, -1, today).data; // 250 ml
    const bs = d.items[0].batches!;
    expect(bs.find((b) => b.useBy === "2026-09-29")!.qty).toBe(250);
    expect(bs.find((b) => b.useBy === "2026-10-05")!.qty).toBe(1000);
  });
  it("classifies what needs attention, most urgent first", () => {
    let d = addToFridge(empty(), { cid: "chicken", qty: 300, useBy: "2026-09-26" }, { today }).data;
    d = addToFridge(d, { cid: "spinach", bestBefore: "2026-09-28" }, { today }).data;
    d = addToFridge(d, { cid: "cheese", bestBefore: "2026-09-20" }, { today }).data;
    d = addToFridge(d, { cid: "rice" }, { today }).data;
    const list = expiring(d.items, today, 2);
    expect(list.map((x) => `${x.item.cid}:${x.info.level}`)).toEqual(["chicken:expired", "spinach:soon", "cheese:past_best"]);
    expect(expiryPhrase(list[1].info, "en")).toBe("Best before tomorrow");
    expect(expiryPhrase(list[0].info, "th")).toBe("หมดอายุแล้ว 1 วัน");
  });
  it("never cooks with food past its use-by date, and can throw it away", () => {
    let d = addToFridge(empty(), { cid: "chicken", qty: 300, useBy: "2026-09-26" }, { today }).data;
    const cards = pickRecipes({ items: d.items, region: "uk", staples: true, today });
    expect(cards.some((c) => c.uses?.some((u) => u.cid === "chicken"))).toBe(false);
    const r = throwAwayExpired(d, d.items[0].id, today);
    expect(r.discarded).toBe(300);
    expect(r.data.list[0].cid).toBe("chicken");
  });
  it("puts expiring food into the recipe ideas first", () => {
    const d = sampleKitchen(today);
    const cards = pickRecipes({ items: d.items, region: "uk", staples: true, today, alertDays: 2 });
    expect(cards[0].uses?.some((u) => u.soon)).toBe(true);
    expect(itemExpiry(d.items.find((i) => i.cid === "pork_mince")!, today, 2)?.level).toBe("soon");
  });
  it("writes a short notification digest", () => {
    const g = digest(
      [
        { name: "Chicken", kind: "use_by", days: -1 },
        { name: "Spinach", kind: "best_before", days: 1 },
      ],
      "en",
    );
    expect(g).toEqual({ title: "1 past use-by · 1 to use soon", body: "Chicken (use-by passed 1 day ago), Spinach (best before tomorrow)" });
  });
});

describe("daily push digest", () => {
  it("keeps the most urgent purchase per item and stops nagging after a few days", async () => {
    const { digestEntries } = await import("../expiry");
    const today = "2026-09-27";
    const e = digestEntries(
      [
        { inventoryId: "milk", useBy: "2026-09-28", qty: 500 },
        { inventoryId: "milk", useBy: "2026-10-04", qty: 1000 },
        { inventoryId: "chicken", useBy: "2026-09-26", qty: 300 },
        { inventoryId: "old-ham", useBy: "2026-09-20", qty: 100 },
        { inventoryId: "rice", bestBefore: "2027-09-01", qty: 1000 },
        { inventoryId: "gone", useBy: "2026-09-27", qty: 0 },
      ],
      today,
      2,
    );
    expect(e).toEqual([
      { inventoryId: "chicken", kind: "use_by", days: -1 },
      { inventoryId: "milk", kind: "use_by", days: 1 },
    ]);
  });
});

describe("dates the cook types replace estimates", () => {
  const T = "2026-09-28";
  it("a real best-before replaces an estimated use-by", () => {
    let d = addToFridge(empty(), { cid: "milk", qty: 1000 }, { today: T }).data;
    expect(d.items[0].batches![0]).toMatchObject({ useBy: "2026-10-05", est: true });
    d = addToFridge(d, { cid: "milk" }, { today: T, dates: { bestBefore: "2026-10-20" } }).data;
    const b = d.items[0].batches![0];
    expect(b.bestBefore).toBe("2026-10-20");
    expect(b.useBy).toBeUndefined();
    expect(b.est).toBeUndefined();
  });
  it("editing one date drops the other estimated date", () => {
    let d = addToFridge(empty(), { cid: "cheese", qty: 200 }, { today: T }).data;
    const it0 = d.items[0];
    d = updateBatch(d, it0.id, it0.batches![0].id, { useBy: "2026-10-01" }, T).data;
    const b = d.items[0].batches![0];
    expect(b.useBy).toBe("2026-10-01");
    expect(b.bestBefore).toBeUndefined();
  });
  it("a new purchase date moves an estimate but keeps typed dates", () => {
    const est = { id: "b", qty: 1, purchased: T, useBy: "2026-10-05", est: true };
    expect(redate("milk", est, { purchased: "2026-09-25" })).toMatchObject({ purchased: "2026-09-25", useBy: "2026-10-02", est: true });
    const typed = { id: "b", qty: 1, purchased: T, useBy: "2026-10-09" };
    expect(redate("milk", typed, { purchased: "2026-09-25" })).toEqual({ id: "b", qty: 1, purchased: "2026-09-25", useBy: "2026-10-09" });
    expect(redate("milk", est, { qty: 0.5 })).toMatchObject({ useBy: "2026-10-05", est: true });
  });
});
