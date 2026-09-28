"use client";

import { CookingPot, Refrigerator, ShoppingCart } from "lucide-react";
import { statusOf } from "@/lib/units";
import { useKitchen } from "@/store/kitchen";
import { useT } from "./ui";

/** Bottom bar on phones: jump between fridge, list and cooking while standing in the kitchen or an aisle. */
export function MobileNav() {
  const t = useT();
  const items = useKitchen((s) => s.data.items);
  const list = useKitchen((s) => s.data.list);
  const low = items.filter((i) => statusOf(i) === "RUNNING_LOW").length;
  const link = "flex flex-1 flex-col items-center gap-px rounded-lg p-1 text-[11.5px] text-muted";
  const badge = "num rounded-md bg-surface-2 px-1.5 text-[10.5px] text-ink";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-surface px-2.5 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 md:hidden">
      <a href="#fridge" className={link}>
        <Refrigerator size={20} />
        <span>{t.fridge}</span>
        <b className={badge}>{low ? `${low} ${t.low}` : items.length}</b>
      </a>
      <a href="#list" className={link}>
        <ShoppingCart size={20} />
        <span>{t.list}</span>
        <b className={badge}>{list.length}</b>
      </a>
      <a href="#cook" className={link}>
        <CookingPot size={20} />
        <span>{t.navCook}</span>
        <b className={badge}>3</b>
      </a>
    </nav>
  );
}
