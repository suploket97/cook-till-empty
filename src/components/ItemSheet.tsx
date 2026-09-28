"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { daysBetween, todayISO } from "@/lib/dates";
import { fifo } from "@/lib/expiry";
import { nameOf, numTxt, packOf, show, unitOf } from "@/lib/units";
import type { Batch, FridgeItem } from "@/lib/types";
import { useKitchen } from "@/store/kitchen";
import { useUi } from "@/store/ui";
import { Sheet } from "./Sheet";
import { btn, btnGhost, cx, useLang, useT } from "./ui";

const field = "w-full min-w-0 rounded-[10px] border-[1.5px] border-line bg-bg px-2.5 py-1.5 text-[14px] focus:border-accent focus:outline-none";

function BatchRow({ item, batch }: { item: FridgeItem; batch: Batch }) {
  const t = useT();
  const lang = useLang();
  const { updateBatch, removeBatch } = useKitchen.getState();
  const d = show(batch.qty, unitOf(item), lang);
  const [qty, setQty] = useState(numTxt(d.n));
  useEffect(() => setQty(numTxt(d.n)), [d.n]);
  const today = todayISO();
  const pastUseBy = !!batch.useBy && daysBetween(today, batch.useBy) < 0;
  const pastBest = !batch.useBy && !!batch.bestBefore && daysBetween(today, batch.bestBefore) < 0;

  const setDate = (key: "purchased" | "useBy" | "bestBefore", v: string) => {
    if (key === "purchased") {
      if (v) updateBatch(item.id, batch.id, { purchased: v });
      return;
    }
    updateBatch(item.id, batch.id, key === "useBy" ? { useBy: v || undefined } : { bestBefore: v || undefined });
  };

  return (
    <li className={cx("flex flex-col gap-2 rounded-xl border p-3", pastUseBy ? "border-bad bg-bad-soft/40" : "border-line bg-bg")}>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="text"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={() => {
              const n = parseFloat(qty.replace(",", "."));
              if (n >= 0 && numTxt(n) !== numTxt(d.n)) updateBatch(item.id, batch.id, { qty: n * d.mult });
              else setQty(numTxt(d.n));
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            aria-label={`${t.amount} (${d.u})`}
            className={cx(field, "num w-20 text-right")}
          />
          <span className="text-muted">{d.u}</span>
        </label>
        {batch.est && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">~ {t.estimated}</span>}
        {pastUseBy && <span className="text-xs font-semibold text-bad">{t.lv_expired}</span>}
        {pastBest && <span className="text-xs font-semibold text-turmeric">{t.lv_past_best}</span>}
        <button type="button" className={cx(btnGhost, "ml-auto")} title={t.removePurchase} aria-label={t.removePurchase} onClick={() => removeBatch(item.id, batch.id)}>
          <Trash2 size={16} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 max-[420px]:grid-cols-1">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t.purchased}
          <input type="date" value={batch.purchased} max={today} onChange={(e) => setDate("purchased", e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t.useBy}
          <input type="date" value={batch.useBy ?? ""} onChange={(e) => setDate("useBy", e.target.value)} className={cx(field, pastUseBy && "border-bad text-bad")} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t.bestBefore}
          <input type="date" value={batch.bestBefore ?? ""} onChange={(e) => setDate("bestBefore", e.target.value)} className={field} />
        </label>
      </div>
    </li>
  );
}

/** Every purchase of one item, with amount, bought date, use-by and best-before — all editable. */
export function ItemSheet() {
  const t = useT();
  const lang = useLang();
  const id = useUi((s) => s.editingItem);
  const close = () => useUi.getState().editItem(null);
  const item = useKitchen((s) => s.data.items.find((i) => i.id === id));
  const { addBatch, throwAway } = useKitchen.getState();
  const today = todayISO();
  const batches = item?.batches ? fifo(item.batches) : [];
  const anyExpired = batches.some((b) => b.useBy && daysBetween(today, b.useBy) < 0);

  return (
    <Sheet open={!!item} onClose={close} title={item ? nameOf(item, lang) : ""} wide>
      {item && (
        <>
          <p className="text-[13px] text-muted">{t.dateRules}</p>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted">{t.purchases}</p>
          {batches.length ? (
            <ul className="flex flex-col gap-2">
              {batches.map((b) => (
                <BatchRow key={b.id} item={item} batch={b} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t.fridgeEmpty}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={() => addBatch(item.id, packOf(item), { purchased: today })}>
              <Plus size={15} />
              {t.addPurchase}
            </button>
            {anyExpired && (
              <button type="button" className={cx(btn, "border-bad text-bad")} onClick={() => throwAway(item.id)}>
                <Trash2 size={15} />
                {t.throwAway}
              </button>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
