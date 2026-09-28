import type { Region } from "../types";

export type Cuisine =
  | "thai" | "british" | "italian" | "french" | "spanish" | "greek_middle_eastern" | "indian"
  | "chinese" | "japanese" | "korean" | "southeast_asian" | "mexican" | "american";
export type Course = "main" | "soup" | "salad" | "side" | "breakfast" | "snack" | "dessert";

export interface Recipe {
  id: string;
  /** Home region of the dish; it gets a small ranking bonus there. "both" for international food. */
  o: Region | "both";
  cuisine: Cuisine;
  course: Course;
  mins: number;
  en: string;
  th: string;
  /** Required groups: any one id in a group satisfies it. */
  req: string[][];
  /** Optional extras used when available. */
  opt: string[];
  /** Substitutions: required id -> ids that can stand in for it. */
  subs: Record<string, string[]>;
  st_en: string[];
  st_th: string[];
}

/**
 * Compact recipe writer.
 *   req:  "pork_mince|chicken; holy_basil; garlic"   (groups split by ";", alternatives by "|")
 *   opt:  "chilli egg"                               (space-separated)
 *   subs: "holy_basil>thai_basil,sweet_basil; fish_sauce>soy_sauce"
 */
export function r(
  id: string,
  o: Recipe["o"],
  cuisine: Cuisine,
  course: Course,
  mins: number,
  en: string,
  th: string,
  req: string,
  opt: string,
  subs: string,
  st_en: string[],
  st_th: string[],
): Recipe {
  const groups = req.split(";").map((g) => g.split("|").map((x) => x.trim()).filter(Boolean)).filter((g) => g.length);
  const subMap: Record<string, string[]> = {};
  for (const part of subs.split(";").map((x) => x.trim()).filter(Boolean)) {
    const [from, to] = part.split(">");
    subMap[from.trim()] = to.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return { id, o, cuisine, course, mins, en, th, req: groups, opt: opt.split(/\s+/).filter(Boolean), subs: subMap, st_en, st_th };
}
