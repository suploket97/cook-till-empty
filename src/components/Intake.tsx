"use client";

import { CalendarDays, Plus } from "lucide-react";
import { useState } from "react";
import { CATALOG, QUICK_ADD, STAPLES } from "@/lib/catalog";
import { todayISO } from "@/lib/dates";
import type { BatchDates } from "@/lib/types";
import { amountText, nameOf } from "@/lib/units";
import { useKitchen } from "@/store/kitchen";
import { Seg, cx, panel, useLang, useT } from "./ui";

export function Intake() {
  const t = useT();
  const lang = useLang();
  const prefs = useKitchen((s) => s.prefs);
  const { submitText, quickAdd, setTarget, setStaples } = useKitchen.getState();
  const [text, setText] = useState("");
  const [showDates, setShowDates] = useState(false);
  const [dates, setDates] = useState<BatchDates>({});
  const today = todayISO();
  const activeDates = (): BatchDates | undefined => (showDates && (dates.purchased || dates.useBy || dates.bestBefore) ? dates : undefined);
  const dateField = "min-w-0 rounded-[10px] border-[1.5px] border-line bg-bg px-2.5 py-1.5 text-[14px] focus:border-accent focus:outline-none";

  return (
    <section aria-labelledby="intake-h" className={cx(panel, "flex flex-col gap-3 p-4 shadow-[0_1px_2px_rgba(24,33,28,.06),0_8px_24px_-12px_rgba(24,33,28,.18)]")}>
      <label id="intake-h" htmlFor="intake" className="font-display text-[17px] font-semibold">
        {t.inputLabel}
      </label>
      <form
        className="flex flex-wrap gap-2"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          submitText(text, prefs.target === "fridge" ? activeDates() : undefined);
          setText("");
          setDates({});
        }}
      >
        <input
          id="intake"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.placeholder}
          className="min-w-0 flex-[1_1_260px] rounded-xl border-[1.5px] border-line bg-bg px-3.5 py-2.5 text-base focus:border-accent focus:outline-none"
        />
        <Seg
          ariaLabel={t.add}
          value={prefs.target}
          onChange={setTarget}
          options={[
            { value: "fridge", label: t.fridge },
            { value: "list", label: t.list },
          ]}
        />
        <button type="submit" className="rounded-[10px] bg-accent px-[18px] py-2.5 font-medium text-accent-ink transition hover:brightness-110 active:scale-[.97]">
          {t.add}
        </button>
      </form>
      <div className="-mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-[12.5px] text-muted">{t.hint}</p>
        {prefs.target === "fridge" && (
          <button
            type="button"
            aria-expanded={showDates}
            onClick={() => setShowDates((v) => !v)}
            className={cx("inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent", showDates && "underline underline-offset-4")}
          >
            <CalendarDays size={14} />
            {t.datesOptional}
          </button>
        )}
      </div>
      {showDates && prefs.target === "fridge" && (
        <div className="flex flex-col gap-2 rounded-xl bg-bg p-3">
          <div className="grid grid-cols-3 gap-2 max-[480px]:grid-cols-1">
            <label className="flex flex-col gap-1 text-xs text-muted">
              {t.purchased}
              <input type="date" value={dates.purchased ?? today} max={today} onChange={(e) => setDates((d) => ({ ...d, purchased: e.target.value || undefined }))} className={dateField} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              {t.useBy}
              <input type="date" value={dates.useBy ?? ""} onChange={(e) => setDates((d) => ({ ...d, useBy: e.target.value || undefined }))} className={dateField} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              {t.bestBefore}
              <input type="date" value={dates.bestBefore ?? ""} onChange={(e) => setDates((d) => ({ ...d, bestBefore: e.target.value || undefined }))} className={dateField} />
            </label>
          </div>
          <p className="text-xs text-muted">{t.datesHint}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted">{t.quick}</span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ADD.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                quickAdd(id, prefs.target === "fridge" ? activeDates() : undefined);
                setDates({});
              }}
              title={amountText(CATALOG[id].pack, CATALOG[id].u, lang)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-line py-1 pl-2 pr-3 text-[13px] hover:border-solid hover:border-accent hover:text-accent"
            >
              <Plus size={13} />
              {nameOf({ cid: id }, lang)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-line pt-3 text-[13.5px]">
        <label className="inline-flex cursor-pointer items-center gap-2.5 font-medium">
          <input
            id="staples"
            type="checkbox"
            checked={prefs.staples}
            onChange={(e) => setStaples(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative h-5 w-[34px] rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-surface after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-3.5 peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
          />
          {t.staples}
        </label>
        <span className={cx("text-muted", !prefs.staples && "line-through opacity-60")}>
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.07em]">{prefs.region === "th" ? t.staplesTH : t.staplesUK}</span>
          {" · "}
          {STAPLES[prefs.region].map((id) => nameOf({ cid: id }, lang)).join(", ")}
        </span>
      </div>
    </section>
  );
}
