"use client";

import { Bell, Cloud, CloudOff, Leaf, LoaderCircle, UserRound } from "lucide-react";
import { useMemo } from "react";
import { todayISO } from "@/lib/dates";
import { expiring } from "@/lib/expiry";
import { totals } from "@/lib/kitchen";
import { statusOf } from "@/lib/units";
import { useKitchen } from "@/store/kitchen";
import { useUi } from "@/store/ui";
import { moneyBoth } from "./RecipeCard";
import { Seg, cx, useT } from "./ui";

export function Header() {
  const t = useT();
  const prefs = useKitchen((s) => s.prefs);
  const items = useKitchen((s) => s.data.items);
  const { setLang, setRegion } = useKitchen.getState();
  const openSheet = useUi((s) => s.openSheet);
  const due = useMemo(() => expiring(items, todayISO(), prefs.alertDays).length, [items, prefs.alertDays]);

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 pb-1 pt-[18px]">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] max-sm:text-[23px]">
          Cook<b className="font-bold text-accent">-Till-</b>Empty
        </h1>
        <p className="text-[13.5px] text-muted">{t.tagline}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Seg
          label={t.kitchen}
          ariaLabel={t.kitchen}
          value={prefs.region}
          onChange={setRegion}
          options={[
            { value: "th", label: "TH" },
            { value: "uk", label: "UK" },
          ]}
        />
        <Seg
          ariaLabel="Language / ภาษา"
          value={prefs.lang}
          onChange={setLang}
          options={[
            { value: "th", label: "ไทย" },
            { value: "en", label: "EN" },
          ]}
        />
        <button
          type="button"
          onClick={() => openSheet("alerts")}
          aria-label={`${t.alerts}${due ? ` (${due})` : ""}`}
          className="relative grid h-9 w-9 place-items-center rounded-[10px] bg-surface-2 text-muted transition hover:text-ink"
        >
          <Bell size={18} />
          {due > 0 && (
            <span className="num absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-bad px-1 text-[10.5px] text-white">
              {due}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => openSheet("account")}
          aria-label={t.account}
          className="grid h-9 w-9 place-items-center rounded-[10px] bg-surface-2 text-muted transition hover:text-ink"
        >
          <UserRound size={18} />
        </button>
      </div>
    </header>
  );
}

export function Tally() {
  const t = useT();
  const data = useKitchen((s) => s.data);
  const region = useKitchen((s) => s.prefs.region);
  const sync = useKitchen((s) => s.sync);
  const tot = totals(data);
  const low = data.items.filter((i) => statusOf(i) === "RUNNING_LOW").length;
  const syncLabel = { local: t.sync_local, syncing: t.syncing, synced: t.sync_cloud, offline: t.offline, error: t.offline }[sync];
  const SyncIcon = sync === "syncing" ? LoaderCircle : sync === "synced" ? Cloud : CloudOff;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted">
      <span className="inline-flex items-center gap-1.5">
        <Leaf size={14} className="text-ok" />
        {t.wasteSaved} <strong className="num font-semibold text-ink">{moneyBoth(tot, region)}</strong>
      </span>
      <span>{t.meals(tot.meals)}</span>
      <span>{t.lowCount(low)}</span>
      <span className={cx("inline-flex items-center gap-1.5 sm:ml-auto", sync === "synced" && "text-ok")}>
        <SyncIcon size={14} className={cx(sync === "syncing" && "animate-spin")} />
        {syncLabel}
      </span>
    </div>
  );
}
