"use client";

import { AnimatePresence, motion } from "motion/react";
import { Refrigerator, ShoppingCart, Trash2, X } from "lucide-react";
import { todayISO } from "@/lib/dates";
import { itemExpiry } from "@/lib/expiry";
import { altNameOf, keyOf, nameOf, statusOf } from "@/lib/units";
import type { FridgeItem, Status } from "@/lib/types";
import { useKitchen } from "@/store/kitchen";
import { useUi } from "@/store/ui";
import { ExpiryBadge } from "./ExpiryBadge";
import { QtyStepper } from "./QtyStepper";
import { btn, btnGhost, cx, panel, useLang, useT } from "./ui";

export const ROW =
  "grid items-center gap-x-2.5 gap-y-1.5 py-2 pl-4 pr-2.5 min-h-[50px] grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] [grid-template-areas:'dot_nm_qty_st_acts'] max-[600px]:grid-cols-[auto_minmax(0,1fr)_auto] max-[600px]:[grid-template-areas:'dot_nm_st'_'._qty_acts'] max-[600px]:py-2.5";

const DOT: Record<Status, string> = { IN_STOCK: "bg-ok", RUNNING_LOW: "bg-warn", OUT_OF_STOCK: "bg-bad" };
const PILL: Record<Status, string> = {
  IN_STOCK: "bg-ok-soft text-ok",
  RUNNING_LOW: "bg-warn-soft text-warn",
  OUT_OF_STOCK: "bg-bad-soft text-bad",
};

function FridgeRow({ item, status }: { item: FridgeItem; status: Status }) {
  const t = useT();
  const lang = useLang();
  const listed = useKitchen((s) => s.data.list.some((l) => keyOf(l) === keyOf(item)));
  const fresh = useKitchen((s) => s.fresh.includes(item.id));
  const alertDays = useKitchen((s) => s.prefs.alertDays);
  const { useUp, toList, remove } = useKitchen.getState();
  const editItem = useUi((s) => s.editItem);
  const alt = altNameOf(item, lang);
  const name = nameOf(item, lang);
  const exp = status !== "OUT_OF_STOCK" ? itemExpiry(item, todayISO(), alertDays) : null;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className={cx(ROW, "border-t border-line/60 first:border-t-0", fresh && "fresh")}
    >
      <span aria-hidden className={cx("h-2.5 w-2.5 rounded-full [grid-area:dot]", DOT[status])} />
      <span className="flex min-w-0 flex-col items-start leading-tight [grid-area:nm]">
        <button
          type="button"
          onClick={() => editItem(item.id)}
          title={t.editDates}
          className={cx("break-words text-left decoration-line underline-offset-4 hover:underline", status === "OUT_OF_STOCK" && "text-muted")}
        >
          {name}
        </button>
        <small className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          {alt && <span>{alt}</span>}
          {exp && (
            <button type="button" onClick={() => editItem(item.id)} className="hover:underline">
              <ExpiryBadge info={exp} />
            </button>
          )}
          {listed && (
            <span className="inline-flex items-center gap-0.5">
              <ShoppingCart size={11} /> {t.onList}
            </span>
          )}
        </small>
      </span>
      <span className="[grid-area:qty] max-[600px]:justify-self-start">
        <QtyStepper where="fridge" item={item} out={status === "OUT_OF_STOCK"} />
      </span>
      <span className={cx("justify-self-end whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold [grid-area:st]", PILL[status])}>
        {t[`st_${status}`]}
      </span>
      <span className="flex items-center gap-0.5 [grid-area:acts] max-[600px]:justify-self-end">
        {status !== "OUT_OF_STOCK" && (
          <button type="button" className={cx(btn, "px-2 py-1 text-[12.5px]")} title={t.useUpTitle} onClick={() => useUp(item.id)}>
            <Trash2 size={14} />
            <span className="max-[420px]:sr-only">{t.useUp}</span>
          </button>
        )}
        {!listed && (
          <button type="button" className={btnGhost} title={t.toList} aria-label={`${t.toList}: ${name}`} onClick={() => toList(item.id)}>
            <ShoppingCart size={16} />
          </button>
        )}
        <button type="button" className={btnGhost} title={t.remove} aria-label={`${t.remove}: ${name}`} onClick={() => remove(item.id)}>
          <X size={16} />
        </button>
      </span>
    </motion.li>
  );
}

export function FridgePanel() {
  const t = useT();
  const lang = useLang();
  const items = useKitchen((s) => s.data.items);
  const groups: [Status, string][] = [
    ["RUNNING_LOW", t.g_low],
    ["IN_STOCK", t.g_in],
    ["OUT_OF_STOCK", t.g_out],
  ];
  const inStock = items.filter((i) => i.qty > 0).length;

  return (
    <section id="fridge" aria-labelledby="fridge-h" className={cx(panel, "scroll-mt-4 overflow-hidden")}>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
        <h2 id="fridge-h" className="flex items-center gap-2 font-display text-lg font-semibold">
          <Refrigerator size={19} className="text-accent" />
          {t.fridge}
        </h2>
        <span className="ml-auto text-[13px] text-muted">{t.items(inStock)}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">{t.fridgeEmpty}</p>
      ) : (
        groups.map(([st, label]) => {
          const rows = items.filter((i) => statusOf(i) === st).sort((a, b) => nameOf(a, lang).localeCompare(nameOf(b, lang)));
          if (!rows.length) return null;
          return (
            <div key={st} className="pb-1.5 pt-1">
              <div className="flex items-center gap-2 px-4 pb-1 pt-2.5 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted">
                {label}
                <span className="num rounded-md bg-surface-2 px-1.5 text-[11px]">{rows.length}</span>
              </div>
              <ul>
                <AnimatePresence initial={false}>
                  {rows.map((it) => (
                    <FridgeRow key={it.id} item={it} status={st} />
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}
