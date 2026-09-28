import { describe, expect, it } from "vitest";
import { CATALOG } from "../catalog";
import { CUISINES, RECIPES, TIPS } from "../recipes";

const COURSES = ["main", "soup", "salad", "side", "breakfast", "snack", "dessert"];

describe("recipe library", () => {
  it("has 200 dishes with unique ids", () => {
    expect(RECIPES.length).toBe(200);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });
  it("only uses ingredients from the catalogue", () => {
    const bad: string[] = [];
    for (const r of RECIPES) {
      const ids = [...r.req.flat(), ...r.opt, ...Object.keys(r.subs), ...Object.values(r.subs).flat()];
      for (const id of ids) if (!CATALOG[id]) bad.push(`${r.id}:${id}`);
    }
    expect(bad).toEqual([]);
  });
  it("is complete in both languages and tagged", () => {
    const bad: string[] = [];
    const cuisines = new Set(CUISINES.map((c) => c.id));
    for (const r of RECIPES) {
      if (!r.en || !r.th || !/[฀-๿]/.test(r.th)) bad.push(`${r.id}:title`);
      if (r.st_en.length < 3 || r.st_en.length !== r.st_th.length) bad.push(`${r.id}:steps`);
      if (r.st_th.some((s) => !/[฀-๿]/.test(s))) bad.push(`${r.id}:thai-steps`);
      if (!cuisines.has(r.cuisine) || !COURSES.includes(r.course)) bad.push(`${r.id}:tags`);
      if (!r.req.length || !(r.mins > 0)) bad.push(`${r.id}:req`);
    }
    expect(bad).toEqual([]);
  });
  it("covers every cuisine and has plenty of desserts", () => {
    for (const c of CUISINES) expect(RECIPES.filter((r) => r.cuisine === c.id).length).toBeGreaterThan(3);
    expect(RECIPES.filter((r) => r.course === "dessert").length).toBeGreaterThan(20);
  });
  it("has tips that point at real ingredients", () => {
    const bad = Object.keys(TIPS).filter((k) => k.split(">").some((id) => !CATALOG[id]));
    expect(bad).toEqual([]);
  });
});

describe("filters, more ideas and surprise", () => {
  it("keeps the A/B/C picks inside the chosen cuisine and course", async () => {
    const { pickRecipes, moreRecipes, surprise, coursesOf } = await import("../matcher");
    const { sampleKitchen } = await import("../kitchen");
    const items = sampleKitchen("2026-09-27").items;
    const ctx = { items, region: "uk" as const, staples: true, today: "2026-09-27", cuisine: "italian" as const, courses: coursesOf("meals") };
    const cards = pickRecipes(ctx).filter((c) => !c.none);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.cuisine === "italian")).toBe(true);
    const more = moreRecipes(ctx, cards.map((c) => c.id!));
    expect([...more.ready, ...more.nearly].every((c) => c.cuisine === "italian" && !cards.some((a) => a.id === c.id))).toBe(true);
    expect(more.nearly.every((c) => (c.missingAll?.length ?? 0) >= 1 && (c.missingAll?.length ?? 0) <= 2)).toBe(true);
    const sweet = surprise({ ...ctx, cuisine: "all", courses: coursesOf("sweet") }, () => 0);
    expect(sweet?.course).toBe("dessert");
  });
});
