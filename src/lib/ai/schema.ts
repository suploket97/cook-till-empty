import { z } from "zod";

/** One AI recipe, in the payload format from the product spec (plus amounts and Thai notes). */
export const AiRecipe = z.object({
  title_th: z.string(),
  title_en: z.string(),
  match_type: z.enum(["ZERO_PURCHASE", "ADAPTED", "PLUS_ONE"]),
  used_ingredients: z.array(z.string()),
  used_amounts: z.array(z.string()).nullable(),
  substitution_notes: z.string().nullable(),
  substitution_notes_th: z.string().nullable(),
  missing_item_to_buy: z.string().nullable(),
  missing_item_to_buy_th: z.string().nullable(),
  missing_item_amount: z.string().nullable(),
  estimated_prep_mins: z.number(),
  steps_th: z.array(z.string()),
  steps_en: z.array(z.string()),
  waste_saved_estimate: z.string(),
});
export type AiRecipe = z.infer<typeof AiRecipe>;

export const AiRecipes = z.object({ recipes: z.array(AiRecipe) });
export type AiRecipes = z.infer<typeof AiRecipes>;

/** What the browser sends: a summary of the fridge, never anything about the person. */
export const RecipesRequest = z.object({
  region: z.enum(["th", "uk"]),
  /** What the cook is in the mood for, from the recipe filters, e.g. "Italian meals" or "desserts". */
  mood: z.string().max(80).optional(),
  staples: z.array(z.string().max(60)).max(20),
  inventory: z
    .array(
      z.object({
        name: z.string().max(80),
        amount: z.string().max(30),
        status: z.enum(["IN_STOCK", "RUNNING_LOW", "OUT_OF_STOCK"]),
        expires: z.string().max(40).optional(),
      }),
    )
    .max(200),
});
export type RecipesRequest = z.infer<typeof RecipesRequest>;

export const ClassifyRequest = z.object({ items: z.array(z.string().min(1).max(60)).min(1).max(20) });

export const Classified = z.object({
  items: z.array(
    z.object({
      input: z.string(),
      en: z.string(),
      th: z.string(),
      category: z.enum(["produce", "meat", "chilled", "pantry"]),
    }),
  ),
});
export type Classified = z.infer<typeof Classified>;
