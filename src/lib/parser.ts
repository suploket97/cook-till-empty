import { ALIASES, CATALOG } from "./catalog";
import { DATE_SOURCE, parseDate, todayISO } from "./dates";
import { keyOf, kindOf } from "./units";
import type { BatchDates, Parsed, Unit } from "./types";

type AmountKind = "mass" | "vol" | "count" | "pack" | "bulb" | "loaf" | "bare";
interface Amount { n: number; kind: AmountKind }

const TH_UNITS: [string, AmountKind, number][] = [
  ["กิโลกรัม", "mass", 1000], ["กิโล", "mass", 1000], ["กก.", "mass", 1000], ["กก", "mass", 1000], ["กรัม", "mass", 1], ["ขีด", "mass", 100],
  ["มิลลิลิตร", "vol", 1], ["ลิตร", "vol", 1000], ["มล.", "vol", 1], ["มล", "vol", 1], ["โหล", "count", 12],
  ["กระป๋อง", "pack", 1], ["แพ็ค", "pack", 1], ["แพ็ก", "pack", 1], ["ห่อ", "pack", 1], ["ถุง", "pack", 1], ["ขวด", "pack", 1], ["กล่อง", "pack", 1],
  ["ฟอง", "count", 1], ["ลูก", "count", 1], ["หัว", "count", 1], ["กำ", "count", 1], ["ต้น", "count", 1], ["ใบ", "count", 1],
  ["กลีบ", "count", 1], ["แผ่น", "count", 1], ["ก้อน", "count", 1], ["ชิ้น", "count", 1],
];

const EN_UNITS: Record<string, [AmountKind, number]> = {
  kg: ["mass", 1000], kgs: ["mass", 1000], kilo: ["mass", 1000], kilos: ["mass", 1000], g: ["mass", 1], gr: ["mass", 1], gram: ["mass", 1], grams: ["mass", 1],
  l: ["vol", 1000], litre: ["vol", 1000], litres: ["vol", 1000], liter: ["vol", 1000], liters: ["vol", 1000], ml: ["vol", 1], pint: ["vol", 568], pints: ["vol", 568],
  dozen: ["count", 12], x: ["count", 1], pc: ["count", 1], pcs: ["count", 1], piece: ["count", 1], pieces: ["count", 1],
  tin: ["pack", 1], tins: ["pack", 1], can: ["pack", 1], cans: ["pack", 1], pack: ["pack", 1], packs: ["pack", 1], bag: ["pack", 1], bags: ["pack", 1],
  bottle: ["pack", 1], bottles: ["pack", 1], jar: ["pack", 1], jars: ["pack", 1], box: ["pack", 1], boxes: ["pack", 1], punnet: ["pack", 1], punnets: ["pack", 1],
  bunch: ["count", 1], bunches: ["count", 1], clove: ["count", 1], cloves: ["count", 1], head: ["count", 1], heads: ["count", 1],
  slice: ["count", 1], slices: ["count", 1], loaf: ["loaf", 1], loaves: ["loaf", 1], cube: ["count", 1], cubes: ["count", 1],
  block: ["count", 1], blocks: ["count", 1], stalk: ["count", 1], stalks: ["count", 1], bulb: ["bulb", 1], bulbs: ["bulb", 1],
};

const isThai = (s: string) => /[฀-๿]/.test(s);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const EN_UNIT_ALT = Object.keys(EN_UNITS).sort((a, b) => b.length - a.length).join("|");
/** Leftover words that are amounts, units or filler, removed before deciding something is a custom ingredient. */
const NOISE = new RegExp(
  `(?:\\d+(?:[.,]\\d+)?|½)\\s*(?:${EN_UNIT_ALT})(?![a-z])|\\b(?:${EN_UNIT_ALT}|some|a|an|of|fresh|and)\\b|` +
    TH_UNITS.map((t) => escapeRe(t[0])).join("|") +
    "|[\\d.,½]+",
  "gi",
);

export function readAmount(chunk: string): Amount | null {
  const m = chunk.match(/(\d+(?:[.,]\d+)?|½)\s*([a-z]+\.?|[฀-๿.]+)?/i);
  if (!m) return null;
  const n = m[1] === "½" ? 0.5 : parseFloat(m[1].replace(",", "."));
  if (!(n > 0)) return null;
  const tok = (m[2] || "").toLowerCase().replace(/\.$/, "");
  if (tok && EN_UNITS[tok]) {
    const [kind, mult] = EN_UNITS[tok];
    return { n: n * mult, kind };
  }
  if (tok && isThai(tok)) {
    const t = TH_UNITS.find(([w]) => tok.startsWith(w.replace(/\.$/, "")));
    if (t) return { n: n * t[2], kind: t[1] };
  }
  return { n, kind: "bare" };
}

/** Turn a parsed amount into a quantity in a sensible unit for this ingredient. */
export function fitAmount(x: Parsed, a: Amount | null): { qty: number; u: Unit } | null {
  if (!a) return null;
  const c = x.cid ? CATALOG[x.cid] : undefined;
  if (!c) {
    if (a.kind === "mass") return { qty: a.n, u: "g" };
    if (a.kind === "vol") return { qty: a.n, u: "ml" };
    return { qty: a.n, u: "pc" };
  }
  const ck = kindOf(c.u);
  if (a.kind === "mass" || a.kind === "vol") {
    if (ck === "mass" || ck === "vol") return { qty: a.n, u: c.u };
    return { qty: a.n, u: a.kind === "mass" ? "g" : "ml" }; // e.g. "1kg potatoes": track this one by weight
  }
  if (a.kind === "bulb" && c.id === "garlic") return { qty: a.n * 10, u: c.u };
  if (ck === "count") return { qty: a.kind === "pack" && c.pack > 1 && c.u !== "tin" ? a.n * c.pack : a.n, u: c.u };
  // A count for something measured by weight/volume means packs, unless it is clearly grams ("chicken 500").
  if (a.kind === "bare" && a.n > 12) return { qty: a.n, u: c.u };
  return { qty: a.n * c.pack, u: c.u };
}

const DATE_KEYWORDS: [keyof BatchDates, string][] = [
  ["bestBefore", "best\\s*-?\\s*before|best\\s*by|bbe|bb|ควรบริโภคก่อน|บริโภคก่อน|ควรบริโภค"],
  ["useBy", "use\\s*-?\\s*by|expiry|expires?|exp\\.?|ub|วันหมดอายุ|หมดอายุ"],
  ["purchased", "bought|purchased|ซื้อเมื่อ|ซื้อวันที่|ซื้อ"],
];
const DATE_RES = DATE_KEYWORDS.map(
  ([field, kw]) => [field, new RegExp(`(?<![a-z])(?:${kw})\\s*[:：]?\\s*(?:on\\s+|วันที่\\s*)?(${DATE_SOURCE})`, "i")] as const,
);

/** Pull "use by 3/10", "หมดอายุ 30 ก.ย.", "bought yesterday"… out of a chunk of text. */
export function readDates(chunk: string, today: string): { dates: BatchDates; rest: string } {
  let rest = chunk;
  const dates: BatchDates = {};
  for (const [field, re] of DATE_RES) {
    const m = rest.match(re);
    if (!m) continue;
    const iso = parseDate(m[1], today, field !== "purchased");
    if (iso) dates[field] = iso;
    rest = rest.replace(m[0], " ");
  }
  return { dates, rest };
}

/**
 * Parse free text in mixed Thai/English into ingredients, e.g.
 * "หมูสับ 300 กรัม, 6 eggs, spinach, นมสด 1 ลิตร use by 3/10".
 * Items are split on commas, "and"/"และ", "+", "/" (not inside dates) and new lines.
 * Thai without spaces is matched by alias.
 */
export function parseText(text: string, today: string = todayISO()): Parsed[] {
  const out: Parsed[] = [];
  const chunks = String(text)
    .split(/[,，、;\n]+|(?<!\d)\/|\/(?!\d)|\s+และ\s+|\s+and\s+|\s*\+\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const raw of chunks) {
    const found: Parsed[] = [];
    const { dates, rest: ch } = readDates(raw.toLowerCase(), today);
    const lower = ch.toLowerCase();
    const amount = readAmount(lower);
    let rest = ` ${lower} `;
    for (const [alias, id] of ALIASES) {
      if (isThai(alias)) {
        if (rest.includes(alias)) {
          found.push({ cid: id });
          rest = rest.split(alias).join(" ");
        }
      } else {
        const re = new RegExp(`(^|[^a-z])${escapeRe(alias)}(?=$|[^a-z])`, "g");
        if (re.test(rest)) {
          found.push({ cid: id });
          rest = rest.replace(re, "$1 ");
        }
      }
    }
    const left = rest.replace(NOISE, " ").replace(/[^\p{L}\p{M}\s'-]/gu, " ").replace(/\s+/g, " ").trim();
    if (left.length >= 2 && !/^(the|of|and|with|some)$/.test(left)) {
      const nm = left.charAt(0).toUpperCase() + left.slice(1);
      found.push(isThai(left) ? { name: nm, th: nm } : { name: nm, en: nm });
    }
    if (found.length === 1 && amount) {
      const f = fitAmount(found[0], amount);
      if (f) {
        found[0].qty = f.qty;
        if (!found[0].cid || f.u !== CATALOG[found[0].cid].u) found[0].u = f.u;
      }
    }
    if (dates.purchased || dates.useBy || dates.bestBefore) for (const f of found) Object.assign(f, dates);
    out.push(...found);
  }

  const seen = new Set<string>();
  return out.filter((x) => {
    const k = keyOf(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
