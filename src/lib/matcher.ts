import { CATALOG, STAPLES } from "./catalog";
import { todayISO } from "./dates";
import { itemExpiry, usableQty } from "./expiry";
import { COURSE_GROUPS, RECIPES, TIPS, type Course, type Cuisine, type Recipe } from "./recipes";
import { priceOf, statusOf, useOf } from "./units";
import type { FridgeItem, RecipeCardData, RecipeUse, Region, Status } from "./types";

export interface MatchContext {
  items: FridgeItem[];
  region: Region;
  staples: boolean;
  /** ISO date; defaults to the local date. */
  today?: string;
  /** Items expiring within this many days are used first. */
  alertDays?: number;
  /** Limit ideas to one cuisine ("all" or unset for everything). */
  cuisine?: Cuisine | "all";
  /** Limit ideas to these courses (unset: everything). */
  courses?: Course[];
}

/** The recipes the current filters allow. */
export function recipePool(ctx: MatchContext): Recipe[] {
  return RECIPES.filter(
    (r) => (!ctx.cuisine || ctx.cuisine === "all" || r.cuisine === ctx.cuisine) && (!ctx.courses || ctx.courses.includes(r.course)),
  );
}

export const coursesOf = (group: string | undefined): Course[] | undefined => COURSE_GROUPS.find((g) => g.id === group)?.courses;

const todayOf = (ctx: MatchContext) => ctx.today ?? todayISO();

/** True when an item's most urgent purchase is due within the alert window (and still safe). */
export function expiresSoon(ctx: MatchContext, id: string): boolean {
  const it = ctx.items.find((i) => i.cid === id);
  if (!it) return false;
  const e = itemExpiry(it, todayOf(ctx), ctx.alertDays ?? 2);
  return !!e && (e.level === "today" || e.level === "soon" || e.level === "past_best");
}

type Avail = Status | "STAPLE" | null;

export function availability(ctx: MatchContext, id: string): Avail {
  const it = ctx.items.find((i) => i.cid === id);
  // Only count what is still safe: anything past its use-by date is left out.
  if (it && usableQty(it, todayOf(ctx)) > 0) return statusOf(it);
  if (ctx.staples && STAPLES[ctx.region].includes(id)) return "STAPLE";
  return null;
}

const RANK: Record<string, number> = { RUNNING_LOW: 0, IN_STOCK: 1, STAPLE: 2 };
const unitPrice = (ctx: MatchContext, id: string) => (CATALOG[id] ? (ctx.region === "th" ? CATALOG[id].thb / 40 : CATALOG[id].gbp) : 1);

interface Evaluation {
  r: Recipe;
  uses: { id: string; status: Status | "STAPLE" }[];
  subs: { from: string; to: string }[];
  missing: string[];
  score: number;
}

export function evaluate(ctx: MatchContext, r: Recipe): Evaluation {
  const uses: Evaluation["uses"] = [];
  const subs: Evaluation["subs"] = [];
  const missing: string[] = [];
  const taken = (id: string) => uses.some((u) => u.id === id);

  for (const group of r.req) {
    // Prefer what is running low, then what is in stock, then staples.
    const have = group
      .map((id) => [id, availability(ctx, id)] as const)
      .filter((x): x is readonly [string, Status | "STAPLE"] => !!x[1] && !taken(x[0]))
      .sort((a, b) => RANK[a[1]] - RANK[b[1]]);
    if (have.length) {
      uses.push({ id: have[0][0], status: have[0][1] });
      continue;
    }
    let sub: { from: string; to: string; status: Status | "STAPLE" } | null = null;
    for (const id of group) {
      for (const s of r.subs[id] || []) {
        const st = availability(ctx, s);
        if (st && !taken(s)) {
          sub = { from: id, to: s, status: st };
          break;
        }
      }
      if (sub) break;
    }
    if (sub) {
      uses.push({ id: sub.to, status: sub.status });
      subs.push({ from: sub.from, to: sub.to });
      continue;
    }
    missing.push([...group].sort((a, b) => unitPrice(ctx, a) - unitPrice(ctx, b))[0]);
  }
  for (const id of r.opt) {
    const st = availability(ctx, id);
    if (st && !taken(id)) uses.push({ id, status: st });
  }
  const real = uses.filter((u) => u.status !== "STAPLE");
  const score =
    real.length +
    2 * real.filter((u) => u.status === "RUNNING_LOW").length +
    3 * real.filter((u) => expiresSoon(ctx, u.id)).length +
    (r.o === ctx.region ? 0.6 : 0);
  return { r, uses, subs, missing, score };
}

/** How much a recipe takes from a stocked item (never more than is there). */
export const takeFrom = (it: FridgeItem, today: string = todayISO()) => Math.min(usableQty(it, today), useOf(it));

/** Rough value of the stock a recipe uses up: the "waste saved" figure. */
export function savedFor(ctx: MatchContext, uses: RecipeUse[]): { thb: number; gbp: number } {
  let thb = 0;
  let gbp = 0;
  for (const u of uses) {
    const it = u.itemId ? ctx.items.find((i) => i.id === u.itemId) : u.cid ? ctx.items.find((i) => i.cid === u.cid) : undefined;
    if (!it || usableQty(it, todayOf(ctx)) <= 0) continue;
    const amount = typeof u.amount === "number" ? Math.min(u.amount, usableQty(it, todayOf(ctx))) : takeFrom(it, todayOf(ctx));
    const p = priceOf(it, amount);
    if (p) {
      thb += p.thb;
      gbp += p.gbp;
    }
  }
  return { thb: Math.round(thb / 5) * 5, gbp: Math.round(gbp * 10) / 10 };
}

function toCard(ctx: MatchContext, kind: RecipeCardData["kind"], e: Evaluation): RecipeCardData {
  const uses: RecipeUse[] = e.uses.map((u) => ({ cid: u.id, status: u.status, ...(expiresSoon(ctx, u.id) ? { soon: true } : {}) }));
  return {
    kind,
    title_en: e.r.en,
    title_th: e.r.th,
    mins: e.r.mins,
    steps_en: e.r.st_en,
    steps_th: e.r.st_th,
    uses,
    swaps: e.subs.map((s) => ({ ...s, tip: TIPS[`${s.from}>${s.to}`] })),
    missing: e.missing.length === 1 ? { cid: e.missing[0] } : null,
    missingAll: e.missing.map((cid) => ({ cid })),
    id: e.r.id,
    cuisine: e.r.cuisine,
    course: e.r.course,
    saved: savedFor(ctx, uses),
  };
}

/**
 * Pick three distinct dishes:
 * A: nothing missing and no swaps; B: nothing missing thanks to a swap; C: exactly one cheap item missing.
 */
export function pickRecipes(ctx: MatchContext): RecipeCardData[] {
  const ev = recipePool(ctx).map((r) => evaluate(ctx, r));
  const A = ev.filter((e) => !e.missing.length && !e.subs.length).sort((a, b) => b.score - a.score)[0] ?? null;
  const B =
    ev
      .filter((e) => !e.missing.length && e.subs.length && e !== A)
      .sort((a, b) => b.score - b.subs.length * 0.5 - (a.score - a.subs.length * 0.5))[0] ?? null;
  const oneAway = (e: Evaluation) => e.missing.length === 1 && e !== A && e !== B;
  const C =
    ev
      .filter((e) => oneAway(e) && !e.subs.length)
      .sort((a, b) => b.score - unitPrice(ctx, b.missing[0]) * 0.4 - (a.score - unitPrice(ctx, a.missing[0]) * 0.4))[0] ??
    ev.filter(oneAway).sort((a, b) => b.score - a.score)[0] ??
    null;
  return (
    [
      ["A", A],
      ["B", B],
      ["C", C],
    ] as const
  ).map(([k, e]) => (e ? toCard(ctx, k, e) : { kind: k, none: true }));
}

/**
 * Everything else worth showing once the A/B/C picks are made:
 * `ready` can be cooked now (maybe with a swap); `nearly` needs one or two things from the shop.
 */
export function moreRecipes(ctx: MatchContext, exclude: string[] = [], limit = 12): { ready: RecipeCardData[]; nearly: RecipeCardData[] } {
  const skip = new Set(exclude);
  const ev = recipePool(ctx).filter((r) => !skip.has(r.id)).map((r) => evaluate(ctx, r));
  const ready = ev.filter((e) => !e.missing.length).sort((a, b) => b.score - a.score);
  const nearly = ev
    .filter((e) => e.missing.length >= 1 && e.missing.length <= 2)
    .sort((a, b) => a.missing.length - b.missing.length || b.score - a.score);
  return {
    ready: ready.slice(0, limit).map((e) => toCard(ctx, "X", e)),
    nearly: nearly.slice(0, limit).map((e) => toCard(ctx, "X", e)),
  };
}

/** A random dish for "Surprise me": something cookable now if possible, otherwise one or two items away. */
export function surprise(ctx: MatchContext, rand: () => number = Math.random, avoid?: string): RecipeCardData | null {
  const ev = recipePool(ctx).map((r) => evaluate(ctx, r)).filter((e) => e.r.id !== avoid);
  const now = ev.filter((e) => !e.missing.length);
  const soon = ev.filter((e) => e.missing.length > 0 && e.missing.length <= 2);
  const pool = now.length ? now : soon.length ? soon : ev;
  if (!pool.length) return null;
  const e = pool[Math.floor(rand() * pool.length)];
  return toCard(ctx, "X", e);
}

/** Card for one recipe by id (e.g. a surprise pick kept on screen). */
export function cardFor(ctx: MatchContext, id: string): RecipeCardData | null {
  const r = RECIPES.find((x) => x.id === id);
  return r ? toCard(ctx, "X", evaluate(ctx, r)) : null;
}
