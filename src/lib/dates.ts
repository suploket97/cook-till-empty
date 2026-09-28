/**
 * Calendar dates as ISO strings (YYYY-MM-DD) in the person's local time zone.
 * Day-first everywhere, as in both the UK and Thailand. Thai Buddhist-era years (e.g. 2569) are converted.
 */
import type { Lang } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

export function todayISO(d: Date = new Date(), timeZone?: string): string {
  if (timeZone) {
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const toUTC = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function addDays(iso: string, n: number): string {
  const t = new Date(toUTC(iso) + n * 86400000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Whole days from `a` to `b` (positive when b is later). */
export const daysBetween = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 86400000);

export const isISODate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const MONTHS_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MONTHS_TH_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

export function formatDate(iso: string, lang: Lang, withYear = false): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (lang === "th") return `${d} ${MONTHS_TH[m - 1]}${withYear ? " " + (y + 543) : ""}`;
  const mon = MONTHS_EN[m - 1];
  return `${d} ${mon.charAt(0).toUpperCase() + mon.slice(1)}${withYear ? " " + y : ""}`;
}

function normYear(y: number): number {
  if (y < 100) y += 2000;
  if (y > 2400) y -= 543; // Buddhist era
  return y;
}

const valid = (y: number, m: number, d: number) => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/** A date pattern, for building parsers: 30/9, 30-09-26, 30.9.2569, 30 Sep, 30 ก.ย., today, tomorrow… */
export const DATE_SOURCE =
  "(?:\\d{1,2}[\\/.\\-]\\d{1,2}(?:[\\/.\\-]\\d{2,4})?" +
  "|\\d{1,2}\\s*(?:" +
  [...MONTHS_TH_FULL, ...MONTHS_TH.map((m) => m.replace(/\./g, "\\.?")), "jan(?:uary)?", "feb(?:ruary)?", "mar(?:ch)?", "apr(?:il)?", "may", "june?", "july?", "aug(?:ust)?", "sep(?:t(?:ember)?)?", "oct(?:ober)?", "nov(?:ember)?", "dec(?:ember)?"].join("|") +
  ")(?:\\s*\\d{2,4})?" +
  "|today|tomorrow|วันนี้|พรุ่งนี้|yesterday|เมื่อวาน)";

/**
 * Read one date. `future` resolves a missing year forwards (expiry dates), otherwise backwards (purchase dates).
 */
export function parseDate(text: string, today: string, future: boolean): string | null {
  const s = text.trim().toLowerCase();
  if (s === "today" || s === "วันนี้") return today;
  if (s === "tomorrow" || s === "พรุ่งนี้") return addDays(today, 1);
  if (s === "yesterday" || s === "เมื่อวาน") return addDays(today, -1);

  let d: number, m: number, y: number | null = null;
  const num = s.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?$/);
  if (num) {
    d = +num[1];
    m = +num[2];
    if (num[3]) y = normYear(+num[3]);
  } else {
    const named = s.match(/^(\d{1,2})\s*([^\d\s]+(?:\s[^\d\s]+)?)\s*(\d{2,4})?$/);
    if (!named) return null;
    d = +named[1];
    const word = named[2].replace(/\s/g, "");
    let idx = MONTHS_TH_FULL.findIndex((w) => word.startsWith(w));
    if (idx < 0) idx = MONTHS_TH.findIndex((w) => word.replace(/\./g, "") === w.replace(/\./g, ""));
    if (idx < 0) idx = MONTHS_EN.findIndex((w) => word.startsWith(w));
    if (idx < 0) return null;
    m = idx + 1;
    if (named[3]) y = normYear(+named[3]);
  }

  const ty = +today.slice(0, 4);
  if (y == null) {
    y = ty;
    const guess = `${y}-${pad(m)}-${pad(d)}`;
    if (valid(y, m, d)) {
      const diff = daysBetween(today, guess);
      if (future && diff < -60) y += 1; // "use by 3/1" typed in December means next January
      if (!future && diff > 7) y -= 1; // "bought 28/12" typed in January means last December
    }
  }
  if (!valid(y, m, d)) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}
