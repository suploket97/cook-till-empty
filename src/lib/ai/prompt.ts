import type { RecipesRequest } from "./schema";

export const RECIPE_SYSTEM = `You are the recipe engine of "Cook-Till-Empty", a zero-waste bilingual Thai/English kitchen app.
You suggest practical home recipes that use up what is already in the fridge. Recipes serve 2.
Write natural Thai (not a word-for-word translation) and plain British English.
Never invent ingredients the cook does not have unless the recipe type allows buying one item.
Include basic food safety where it matters (e.g. cook chicken and pork through). Do not make health claims.`;

export function recipePrompt(req: RecipesRequest): string {
  const region =
    req.region === "th"
      ? "Thailand (Thai home kitchen, Thai fresh markets and supermarkets, prices in THB)"
      : "the United Kingdom (a Thai or British home cook in a UK kitchen, UK supermarkets, prices in GBP)";
  const staples = req.staples.length ? req.staples.join(", ") : "none assumed";
  return `The cook is in ${region}.
Current inventory with amounts (JSON): ${JSON.stringify(req.inventory)}
Items with status OUT_OF_STOCK are NOT available. Do not use more of an item than the amount in stock.
Items with an "expires" note are close to their use-by or best-before date: build the recipes around them first. Then prioritise RUNNING_LOW items.
Pantry staples assumed available: ${staples}.
${req.mood ? `The cook would like: ${req.mood}. Keep all three recipes within this.\n` : ""}
Return exactly three recipes, one of each match_type, in this order:
1. "ZERO_PURCHASE": uses strictly available items plus staples. No substitutions, nothing to buy.
2. "ADAPTED": a smart substitution, e.g. Thai sweet basil or Italian basil for holy basil when cooking Thai food in the UK, or soy sauce for fish sauce. Explain the swap and how to adjust.
3. "PLUS_ONE": needs exactly one cheap missing ingredient that unlocks a clearly better meal. Nothing else missing.
Make the three dishes distinct. Mix Thai and Western dishes where the inventory allows.

Field rules:
- used_ingredients: English names exactly as in the inventory (the part before " / ").
- used_amounts: the amount of each used ingredient, same order and same units as the inventory, e.g. "250 g", "2 eggs".
- substitution_notes / substitution_notes_th: only for ADAPTED, otherwise null.
- missing_item_to_buy: short English ingredient name only for PLUS_ONE, otherwise null; missing_item_to_buy_th its Thai name; missing_item_amount how much to buy, e.g. "400 ml".
- steps_en / steps_th: 4 to 6 short steps each, with amounts, no numbering.
- waste_saved_estimate: rough value of the stock used, formatted like "120 THB / £3.00".`;
}

export const CLASSIFY_SYSTEM =
  "You label grocery items for a bilingual Thai/English kitchen app. For each input item give its English name, its Thai name, and one category: produce, meat, chilled or pantry. Keep the same order as the input.";
