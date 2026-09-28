"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, CookingPot, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { formatDate, todayISO } from "@/lib/dates";
import { expiring, expiryPhrase } from "@/lib/expiry";
import { amountText, nameOf, unitOf } from "@/lib/units";
import { useKitchen } from "@/store/kitchen";
import { useUi } from "@/store/ui";
import { LEVEL_TEXT } from "./ExpiryBadge";
import { btn, cx, panel, useLang, useT } from "./ui";

/** Everything near or past its date, most urgent first, with the one action that fits each. */
export function ExpiringPanel() {
  const t = useT();
  const lang = useLang();
  const items = useKitchen((s) => s.data.items);
  const alertDays = useKitchen((s) => s.prefs.alertDays);
  const throwAway = useKitchen((s) => s.throwAway);
  const editItem = useUi((s) => s.editItem);
  const list = useMemo(() => expiring(items, todayISO(), alertDays), [items, alertDays]);
  if (!list.length) return null;

  return (
    <section id="expiring" aria-labelledby="expiring-h" className={cx(panel, "scroll-mt-4 overflow-hidden border-warn/50")}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-line bg-warn-soft/50 px-4 py-3">
        <h2 id="expiring-h" className="flex items-center gap-2 font-display text-lg font-semibold">
          <AlarmClock size={19} className="text-warn" />
          {t.expiringTitle}
        </h2>
        <span className="text-[13px] text-muted">{t.expiringSub(list.length)}</span>
      </div>
      <ul>
        <AnimatePresence initial={false}>
          {list.map(({ item, info }) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line/60 px-4 py-2.5 first:border-t-0"
            >
              <button type="button" onClick={() => editItem(item.id)} className="flex min-w-0 flex-1 flex-col items-start text-left leading-tight">
                <span className="font-medium hover:underline">{nameOf(item, lang)}</span>
                <small className="text-xs text-muted">
                  <span className="num">{amountText(info.qty, unitOf(item), lang)}</span> · {info.kind === "use_by" ? t.useBy : t.bestBefore}{" "}
                  {info.est ? "~" : ""}
                  {formatDate(info.date, lang)}
                </small>
              </button>
              <span className={cx("text-[13px] font-semibold", LEVEL_TEXT[info.level])}>
                {info.level === "expired" ? t.lv_expired : info.level === "past_best" ? `${expiryPhrase(info, lang)} · ${t.lv_past_best}` : expiryPhrase(info, lang)}
              </span>
              {info.level === "expired" ? (
                <button type="button" className={cx(btn, "border-bad px-2.5 py-1 text-[12.5px] text-bad")} onClick={() => throwAway(item.id)}>
                  <Trash2 size={14} />
                  {t.throwAway}
                </button>
              ) : (
                <a href="#cook" className={cx(btn, "px-2.5 py-1 text-[12.5px]")}>
                  <CookingPot size={14} />
                  {t.findRecipe}
                </a>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
