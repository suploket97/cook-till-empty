"use client";

import { Check, Clock, ShoppingCart } from "lucide-react";
import { CATALOG } from "@/lib/catalog";
import { takeFrom } from "@/lib/matcher";
import { CUISINES } from "@/lib/recipes";
import { todayISO } from "@/lib/dates";
import { usableQty } from "@/lib/expiry";
import { amountText, keyOf, nameOf, priceOf, unitOf } from "@/lib/units";
import type { RecipeCardData, RecipeUse } from "@/lib/types";
import { useKitchen } from "@/store/kitchen";
import { money1 } from "./ListPanel";
import { btn, cx, useLang, useT } from "./ui";

const LETTER: Record<RecipeCardData["kind"], string> = {
  A: "bg-ok-soft text-ok",
  B: "bg-accent-soft text-accent",
  C: "bg-turmeric-soft text-turmeric",
  X: "bg-surface-2 text-muted",
};

export const moneyBoth = (s: { thb: number; gbp: number }, region: "th" | "uk") =>
  region === "th" ? `฿${Math.round(s.thb)} / £${s.gbp.toFixed(2)}` : `£${s.gbp.toFixed(2)} / ฿${Math.round(s.thb)}`;

function UseChip({ u }: { u: RecipeUse }) {
  const t = useT();
  const lang = useLang();
  const items = useKitchen((s) => s.data.items);
  const item = u.itemId ? items.find((i) => i.id === u.itemId) : u.cid ? items.find((i) => i.cid === u.cid && i.qty > 0) : undefined;
  const label = u.cid ? nameOf({ cid: u.cid }, lang) : item ? nameOf(item, lang) : u.label;
  const amount = item ? amountText(typeof u.amount === "number" ? Math.min(u.amount, usableQty(item, todayISO())) : takeFrom(item), unitOf(item), lang) : "";
  return (
    <span
      className={cx(
        "rounded-full border px-2 py-px text-xs",
        u.soon && "border-transparent bg-bad-soft font-semibold text-bad",
        !u.soon && u.status === "RUNNING_LOW" && "border-transparent bg-warn-soft font-semibold text-warn",
        u.status === "STAPLE" && "border-dashed border-line text-muted",
        !u.soon && u.status !== "RUNNING_LOW" && u.status !== "STAPLE" && "border-line bg-surface",
      )}
    >
      {label}
      {amount && <span className="num"> {amount}</span>}
      {u.soon ? ` · ${t.soonTag}` : u.status === "RUNNING_LOW" && ` · ${t.low}`}
    </span>
  );
}

export function RecipeCard({ card }: { card: RecipeCardData }) {
  const t = useT();
  const lang = useLang();
  const region = useKitchen((s) => s.prefs.region);
  const missingList = card.missingAll?.length ? card.missingAll : card.missing ? [card.missing] : [];
  const listedMissing = useKitchen((s) => missingList.length > 0 && missingList.every((m) => s.data.list.some((l) => keyOf(l) === keyOf(m))));
  const { cooked, addMissing } = useKitchen.getState();
  const cuisine = CUISINES.find((c) => c.id === card.cuisine);

  const head =
    card.kind === "X" ? (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold tracking-[0.04em] text-muted">
        {cuisine && <span className="rounded-full bg-surface-2 px-2 py-0.5">{cuisine[lang]}</span>}
        {missingList.length === 0 && <span className="text-ok">{card.swaps?.length ? t.B : t.A}</span>}
      </div>
    ) : (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold tracking-[0.04em]">
        <span className={cx("grid h-[22px] w-[22px] place-items-center rounded-md font-display text-[13px]", LETTER[card.kind])}>{card.kind}</span>
        <span>{t[card.kind]}</span>
        {cuisine && card.cuisine !== "thai" && <span className="rounded-full bg-surface-2 px-2 py-0.5 font-normal text-muted">{cuisine[lang]}</span>}
        <span className="basis-full font-normal tracking-normal text-muted">{t[`${card.kind}_d`]}</span>
      </div>
    );

  if (card.none && card.kind !== "X")
    return (
      <article className="flex flex-col gap-2 rounded-[14px] border border-line bg-bg p-3.5">
        {head}
        <p className="text-sm text-muted">{t[`none${card.kind}`]}</p>
      </article>
    );

  const title = lang === "th" ? card.title_th : card.title_en;
  const alt = lang === "th" ? card.title_en : card.title_th;
  const steps = lang === "th" ? card.steps_th : card.steps_en;
  const buyRows = missingList.map((m) => {
    const u = m.u ?? (m.cid ? CATALOG[m.cid].u : "pc");
    const q = typeof m.qty === "number" ? m.qty : m.cid ? CATALOG[m.cid].pack : null;
    return { m, u, q, price: m.cid && q ? priceOf({ ...m, u }, q) : null };
  });
  const saved = card.saved && (card.saved.thb || card.saved.gbp) ? moneyBoth(card.saved, region) : card.savedText || "—";

  return (
    <article className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-bg">
      <div className="flex flex-col gap-1.5 px-3.5 pb-2.5 pt-3">
        {head}
        <h3 className="mt-0.5 font-display text-[19px] font-semibold leading-tight">{title}</h3>
        {alt && <div className="-mt-0.5 text-[13px] text-muted">{alt}</div>}
        {card.mins ? (
          <div className="flex items-center gap-1 text-[12.5px] text-muted">
            <Clock size={13} />
            <span className="num">{card.mins}</span> {t.min}
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-3.5 pb-3">
        <div className="flex flex-wrap gap-1" aria-label={t.uses}>
          {(card.uses || []).map((u, i) => (
            <UseChip key={`${u.cid ?? u.itemId ?? u.label}-${i}`} u={u} />
          ))}
        </div>
        {card.swaps?.map((s) => (
          <div key={s.from} className="rounded-[10px] bg-accent-soft px-2.5 py-2 text-[13px]">
            <b className="font-semibold">{nameOf({ cid: s.to }, lang)}</b> {lang === "th" ? "แทน" : "instead of"}{" "}
            <b className="font-semibold">{nameOf({ cid: s.from }, lang)}</b>
            {s.tip && `. ${s.tip[lang === "th" ? 1 : 0]}`}
          </div>
        ))}
        {card.noteText && <div className="rounded-[10px] bg-accent-soft px-2.5 py-2 text-[13px]">{card.noteText[lang]}</div>}
        {buyRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-turmeric-soft px-2.5 py-2 text-[13px]">
            <span>
              {t.buy}:{" "}
              {buyRows.map(({ m, u, q, price }, i) => (
                <span key={keyOf(m)}>
                  {i > 0 && ", "}
                  <b className="font-semibold">{nameOf(m, lang)}</b>
                  {q ? <span className="num"> {amountText(q, u, lang)}</span> : null}
                  {price && <span className="num text-xs text-muted"> ~{money1(price, region)}</span>}
                </span>
              ))}
            </span>
            {listedMissing ? (
              <span className={cx(btn, "ml-auto px-2 py-1 text-[12.5px]")} aria-disabled>
                <Check size={14} />
                {t.onListNow}
              </span>
            ) : (
              <button type="button" className={cx(btn, "ml-auto px-2 py-1 text-[12.5px]")} onClick={() => addMissing(card)}>
                <ShoppingCart size={14} />
                {buyRows.length > 1 ? t.addAllMissing : t.addMissing}
              </button>
            )}
          </div>
        )}
        {steps && steps.length > 0 && (
          <details className="group">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-accent [&::-webkit-details-marker]:hidden">
              <span className="num w-3">
                <span className="group-open:hidden">+</span>
                <span className="hidden group-open:inline">−</span>
              </span>
              {t.method}
            </summary>
            <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-[13.5px]">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </details>
        )}
        {card.ai && <p className="text-[11.5px] text-muted">{t.aiDisclosure}</p>}
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-line bg-surface px-3.5 py-2.5">
        <span className="text-[12.5px] leading-tight text-muted">
          {t.saves}
          <br />
          <b className="num font-semibold text-ok">{saved}</b>
        </span>
        <button type="button" className={cx(btn, "ml-auto")} onClick={() => cooked(card)}>
          <Check size={15} />
          {t.cooked}
        </button>
      </div>
    </article>
  );
}
