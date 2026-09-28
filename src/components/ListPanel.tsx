"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ShoppingCart, X } from "lucide-react";
import { AISLES, aisleOf } from "@/lib/catalog";
import { altNameOf, categoryOf, nameOf, priceOf } from "@/lib/units";
import type { ListItem, Region } from "@/lib/types";
import { useKitchen } from "@/store/kitchen";
import { ROW } from "./FridgePanel";
import { QtyStepper } from "./QtyStepper";
import { btnGhost, cx, panel, useLang, useT } from "./ui";

export const money1 = (p: { thb: number; gbp: number }, region: Region) =>
  region === "th" ? `฿${Math.round(p.thb)}` : `£${p.gbp.toFixed(2)}`;

function ListRow({ item }: { item: ListItem }) {
  const t = useT();
  const lang = useLang();
  const region = useKitchen((s) => s.prefs.region);
  const fresh = useKitchen((s) => s.fresh.includes(item.id));
  const { bought, removeFromList } = useKitchen.getState();
  const alt = altNameOf(item, lang);
  const name = nameOf(item, lang);
  const p = priceOf(item, item.qty);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.18 }}
      className={cx(ROW, "border-t border-line/60 first:border-t-0", fresh && "fresh")}
    >
      <button
        type="button"
        onClick={() => bought(item.id)}
        title={t.markBought}
        aria-label={`${t.markBought}: ${name}`}
        className="grid h-6 w-6 place-items-center rounded-[7px] border-[1.5px] border-muted text-transparent transition hover:border-accent hover:text-accent [grid-area:dot]"
      >
        <Check size={15} />
      </button>
      <span className="flex min-w-0 flex-col leading-tight [grid-area:nm]">
        <span className="break-words">{name}</span>
        <small className="text-xs text-muted">
          {alt}
          {item.from && (
            <span className="text-turmeric">
              {alt && " · "}
              {t.fromRecipe} {item.from}
            </span>
          )}
        </small>
      </span>
      <span className="[grid-area:qty] max-[600px]:justify-self-start">
        <QtyStepper where="list" item={item} />
      </span>
      <span className="num min-w-[52px] justify-self-end text-right text-[12.5px] text-muted [grid-area:st]">{p ? `~${money1(p, region)}` : ""}</span>
      <span className="flex justify-self-end [grid-area:acts]">
        <button type="button" className={btnGhost} title={t.remove} aria-label={`${t.remove}: ${name}`} onClick={() => removeFromList(item.id)}>
          <X size={16} />
        </button>
      </span>
    </motion.li>
  );
}

export function ListPanel() {
  const t = useT();
  const lang = useLang();
  const region = useKitchen((s) => s.prefs.region);
  const list = useKitchen((s) => s.data.list);
  const total = list.reduce(
    (acc, i) => {
      const p = priceOf(i, i.qty);
      return p ? { thb: acc.thb + p.thb, gbp: acc.gbp + p.gbp, n: acc.n + 1 } : acc;
    },
    { thb: 0, gbp: 0, n: 0 },
  );

  return (
    <section id="list" aria-labelledby="list-h" className={cx(panel, "scroll-mt-4 overflow-hidden")}>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
        <h2 id="list-h" className="flex items-center gap-2 font-display text-lg font-semibold">
          <ShoppingCart size={19} className="text-accent" />
          {t.list}
        </h2>
        <span className="ml-auto text-[13px] text-muted">
          {t.toBuy(list.length)}
          {total.n > 0 && (
            <>
              {" · "}
              {t.est} <span className="num">{money1(total, region)}</span>
            </>
          )}
        </span>
      </div>
      {list.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">{t.listEmpty}</p>
      ) : (
        AISLES[region].map(([aisle, label]) => {
          const rows = list.filter((i) => aisleOf(categoryOf(i), region) === aisle);
          if (!rows.length) return null;
          return (
            <div key={aisle} className="pb-1.5 pt-1">
              <div className="flex items-center gap-2 px-4 pb-1 pt-2.5 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted">
                {label[lang]}
                <span className="num rounded-md bg-surface-2 px-1.5 text-[11px]">{rows.length}</span>
              </div>
              <ul>
                <AnimatePresence initial={false}>
                  {rows.map((it) => (
                    <ListRow key={it.id} item={it} />
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
