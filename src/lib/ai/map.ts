/** Client-side: build the AI request from the fridge, and turn the AI reply into recipe cards. */
import { CATALOG, STAPLES } from "../catalog";
import { COURSE_GROUPS, CUISINES } from "../recipes";
import { availability, savedFor, type MatchContext } from "../matcher";
import { parseText } from "../parser";
import { todayISO } from "../dates";
import { expiryPhrase, itemExpiry, usableQty } from "../expiry";
import { amountText, convertInto, statusOf, unitOf } from "../units";
import type { FridgeItem, Parsed, RecipeCardData, RecipeUse } from "../types";
import type { AiRecipe, RecipesRequest } from "./schema";

export function buildRequest(ctx: MatchContext): RecipesRequest {
  const today = ctx.today ?? todayISO();
  const cuisine = CUISINES.find((c) => c.id === ctx.cuisine)?.en;
  const group = COURSE_GROUPS.find((g) => ctx.courses && g.courses.length === ctx.courses.length && g.courses.every((c) => ctx.courses!.includes(c)));
  const mood = [cuisine, group && group.id !== "all" ? group.en.toLowerCase() : null].filter(Boolean).join(" ");
  return {
    region: ctx.region,
    ...(mood ? { mood } : {}),
    staples: ctx.staples ? STAPLES[ctx.region].map((id) => CATALOG[id].en) : [],
    // Only what is safe to eat: stock past its use-by date is left out entirely.
    inventory: ctx.items.slice(0, 200).map((i) => {
      const usable = usableQty(i, today);
      const e = usable > 0 ? itemExpiry(i, today, ctx.alertDays ?? 2) : null;
      return {
        name: i.cid ? `${CATALOG[i.cid].en} / ${CATALOG[i.cid].th}` : `${i.en || i.name || ""}${i.th ? " / " + i.th : ""}`.slice(0, 80),
        amount: amountText(usable, unitOf(i), "en"),
        status: usable > 0 ? statusOf({ ...i, qty: usable }) : "OUT_OF_STOCK",
        ...(e && e.level !== "ok" && e.level !== "expired" ? { expires: expiryPhrase(e, "en") } : {}),
      };
    }),
  };
}

const ORDER = { ZERO_PURCHASE: "A", ADAPTED: "B", PLUS_ONE: "C" } as const;
const stripNumbering = (a: string[]) => a.map((s) => String(s).replace(/^\s*\d+[.)]\s*/, ""));

function findCustom(items: FridgeItem[], name: string) {
  const n = name.toLowerCase();
  return items.find((i) => !i.cid && [i.en, i.name, i.th].some((v) => v && v.toLowerCase() === n));
}

export function aiToCards(recipes: AiRecipe[], ctx: MatchContext): RecipeCardData[] {
  return recipes
    .slice(0, 3)
    .map((x, idx): RecipeCardData => {
      const amounts = x.used_amounts ?? [];
      const uses: RecipeUse[] = x.used_ingredients.map((name, j) => {
        const p = parseText(`${name}${amounts[j] ? " " + amounts[j] : ""}`)[0];
        let item: FridgeItem | undefined;
        let use: RecipeUse;
        if (p?.cid) {
          item = ctx.items.find((i) => i.cid === p.cid);
          use = { cid: p.cid, status: availability(ctx, p.cid) ?? "IN_STOCK" };
        } else {
          item = findCustom(ctx.items, name);
          use = item ? { itemId: item.id, status: statusOf(item) } : { label: name, status: "IN_STOCK" };
        }
        if (item && p && typeof p.qty === "number") {
          const conv = convertInto(item, p.qty, p.u ?? (p.cid ? CATALOG[p.cid].u : "pc"));
          if (conv != null) use.amount = conv;
        }
        return use;
      });
      let missing: Parsed | null = null;
      if (x.missing_item_to_buy) {
        const p = parseText(`${x.missing_item_to_buy}${x.missing_item_amount ? " " + x.missing_item_amount : ""}`)[0];
        missing = p?.cid ? p : { name: x.missing_item_to_buy, en: x.missing_item_to_buy, th: x.missing_item_to_buy_th ?? undefined };
      }
      return {
        kind: ORDER[x.match_type] ?? (["A", "B", "C"] as const)[idx],
        ai: true,
        title_en: x.title_en,
        title_th: x.title_th,
        mins: x.estimated_prep_mins || null,
        steps_en: stripNumbering(x.steps_en),
        steps_th: stripNumbering(x.steps_th),
        uses,
        noteText: x.substitution_notes ? { en: x.substitution_notes, th: x.substitution_notes_th || x.substitution_notes } : null,
        missing,
        savedText: x.waste_saved_estimate || null,
        saved: savedFor(ctx, uses),
      };
    })
    .sort((a, b) => a.kind.localeCompare(b.kind));
}
