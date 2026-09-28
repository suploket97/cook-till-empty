"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { nameOf, numTxt, show, unitOf } from "@/lib/units";
import type { FridgeItem, ListItem } from "@/lib/types";
import { useKitchen } from "@/store/kitchen";
import { cx, useLang, useT } from "./ui";

/** − [amount] unit + — the amount can also be typed. Shows kg/L from 1000 g/ml. */
export function QtyStepper({ where, item, out }: { where: "fridge" | "list"; item: FridgeItem | ListItem; out?: boolean }) {
  const lang = useLang();
  const t = useT();
  const step = useKitchen((s) => s.step);
  const setQty = useKitchen((s) => s.setQty);
  const d = show(item.qty || 0, unitOf(item), lang);
  const [draft, setDraft] = useState(numTxt(d.n));
  useEffect(() => setDraft(numTxt(d.n)), [d.n]);
  const name = nameOf(item, lang);

  const commit = () => {
    const n = parseFloat(draft.replace(",", "."));
    if (!(n >= 0) || numTxt(n) === numTxt(d.n)) return setDraft(numTxt(d.n));
    setQty(where, item.id, n * d.mult);
  };

  return (
    <span className="inline-flex h-8 items-center rounded-[10px] border border-line bg-bg">
      <button
        type="button"
        onClick={() => step(where, item.id, -1)}
        aria-label={`${t.less}: ${name}`}
        className="grid h-full w-[30px] place-items-center rounded-[9px] text-muted hover:bg-surface-2 hover:text-accent"
      >
        <Minus size={14} />
      </button>
      <input
        id={`qty-${item.id}`}
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        aria-label={`${t.amount}: ${name} (${d.u})`}
        className={cx("num w-[50px] min-w-0 bg-transparent px-0.5 text-right text-[13.5px] focus:bg-surface focus:outline-none", out && "text-bad")}
      />
      <span className="min-w-[34px] whitespace-nowrap pl-1 pr-0.5 text-xs text-muted">{d.u}</span>
      <button
        type="button"
        onClick={() => step(where, item.id, 1)}
        aria-label={`${t.more}: ${name}`}
        className="grid h-full w-[30px] place-items-center rounded-[9px] text-muted hover:bg-surface-2 hover:text-accent"
      >
        <Plus size={14} />
      </button>
    </span>
  );
}
