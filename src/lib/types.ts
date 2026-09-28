export type Lang = "th" | "en";
export type Region = "th" | "uk";
export type Category = "produce" | "meat" | "chilled" | "pantry";
export type Status = "IN_STOCK" | "RUNNING_LOW" | "OUT_OF_STOCK";

/** g and ml are measured; the rest are counted (with an English noun and a Thai classifier). */
export type Unit =
  | "g" | "ml"
  | "egg" | "clove" | "tuber" | "fruit" | "head" | "bunch" | "stalk"
  | "leaf" | "slice" | "tin" | "cube" | "block" | "pc";

/** Something that names an ingredient: either a catalogue id (`cid`) or free text. */
export interface IngredientRef {
  cid?: string;
  name?: string;
  en?: string;
  th?: string;
  cat?: Category;
  /** Unit override, only when it differs from the catalogue unit (e.g. potatoes by weight). */
  u?: Unit;
}

/** Dates a person can give (or the app estimates) for one purchase. ISO YYYY-MM-DD. */
export interface BatchDates {
  purchased?: string;
  /** Safety date: don't eat after it. */
  useBy?: string;
  /** Quality date: fine after it, but check. */
  bestBefore?: string;
}

/** One purchase of an item, with its own amount and dates. */
export interface Batch extends BatchDates {
  id: string;
  qty: number;
  purchased: string;
  /** True when the use-by / best-before were estimated from typical shelf life. */
  est?: boolean;
}

export interface FridgeItem extends IngredientRef {
  id: string;
  /** Total amount; always the sum of `batches` when batches are present. */
  qty: number;
  /** Amount at the last restock; "running low" is measured against it. */
  full: number;
  /** Purchases, used oldest-expiry first. Older saved data may not have them. */
  batches?: Batch[];
  updatedAt: number;
}

export interface ListItem extends IngredientRef {
  id: string;
  qty: number;
  from?: string;
  updatedAt: number;
}

export interface CookEntry {
  id: string;
  title: string;
  thb: number;
  gbp: number;
  at: number;
}

export interface Prefs {
  lang: Lang;
  region: Region;
  staples: boolean;
  target: "fridge" | "list";
  /** Warn this many days before a use-by / best-before date. */
  alertDays: number;
  /** Show a device notification for expiring food. */
  notify: boolean;
  /** Recipe filters: a cuisine id or "all", and a course group id. */
  cuisine: string;
  courseGroup: string;
}

export interface KitchenData {
  items: FridgeItem[];
  list: ListItem[];
  log: CookEntry[];
}

/** A parsed ingredient, possibly with an amount and dates. */
export interface Parsed extends IngredientRef, BatchDates {
  qty?: number;
}

export interface RecipeUse {
  cid?: string;
  /** Fridge item id, for custom (non-catalogue) ingredients. */
  itemId?: string;
  label?: string;
  status: Status | "STAPLE";
  /** Amount the recipe takes, in the fridge item's unit. */
  amount?: number;
  /** The item is close to its use-by / best-before date. */
  soon?: boolean;
}

export interface RecipeCardData {
  /** A/B/C are the three headline ideas; X is any other dish (more ideas, surprise pick). */
  kind: "A" | "B" | "C" | "X";
  id?: string;
  cuisine?: string;
  course?: string;
  /** Everything the dish still needs from the shop (C and X cards). */
  missingAll?: Parsed[];
  none?: boolean;
  ai?: boolean;
  title_en?: string;
  title_th?: string;
  mins?: number | null;
  steps_en?: string[];
  steps_th?: string[];
  uses?: RecipeUse[];
  swaps?: { from: string; to: string; tip?: [string, string] }[];
  noteText?: { en: string; th: string } | null;
  missing?: Parsed | null;
  saved?: { thb: number; gbp: number };
  savedText?: string | null;
}
