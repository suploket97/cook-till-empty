"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useKitchen } from "@/store/kitchen";
import { digest, expiring } from "@/lib/expiry";
import { todayISO } from "@/lib/dates";
import { nameOf } from "@/lib/units";
import { showLocal, syncPushPrefs } from "@/lib/push/client";
import { AccountSheet } from "./AccountSheet";
import { AlertsSheet } from "./AlertsSheet";
import { CookPanel } from "./CookPanel";
import { ExpiringPanel } from "./ExpiringPanel";
import { ItemSheet } from "./ItemSheet";
import { FridgePanel } from "./FridgePanel";
import { Header, Tally } from "./Header";
import { Intake } from "./Intake";
import { ListPanel } from "./ListPanel";
import { MobileNav } from "./MobileNav";
import { SyncController } from "./SyncController";
import { Toast } from "./Toast";
import { useLang, useT } from "./ui";

function useHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const unsub = useKitchen.persist.onFinishHydration(() => setReady(true));
    if (useKitchen.persist.hasHydrated()) setReady(true);
    return unsub;
  }, []);
  return ready;
}

export function KitchenApp({ syncAvailable }: { syncAvailable: boolean }) {
  const ready = useHydrated();
  const lang = useLang();
  const t = useT();
  const household = useKitchen((s) => s.household);
  const alertDays = useKitchen((s) => s.prefs.alertDays);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Keep the daily push in the person's language and warning window.
  useEffect(() => {
    if (household) void syncPushPrefs(lang, alertDays);
  }, [household, lang, alertDays]);

  // Without daily push (not signed in), remind once a day when the app is opened.
  useEffect(() => {
    if (!ready) return;
    const s = useKitchen.getState();
    if (!s.prefs.notify || s.household || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const today = todayISO();
    try {
      if (localStorage.getItem("cte-local-notice") === today) return;
    } catch {
      return;
    }
    const list = expiring(s.data.items, today, s.prefs.alertDays);
    const msg = digest(list.map(({ item, info }) => ({ name: nameOf(item, s.prefs.lang), kind: info.kind, days: info.days })), s.prefs.lang);
    if (!msg) return;
    void showLocal(msg.title, msg.body);
    try {
      localStorage.setItem("cte-local-notice", today);
    } catch {
      /* private mode */
    }
  }, [ready]);

  return (
    <>
      <SyncController />
      {ready ? (
        <motion.main
          key={lang}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22 }}
          className="mx-auto flex max-w-[1180px] flex-col gap-[18px] px-4 pb-12 max-md:pb-24"
        >
          <Header />
          <Tally />
          <ExpiringPanel />
          <Intake />
          <div className="grid items-start gap-[18px] md:grid-cols-2">
            <FridgePanel />
            <ListPanel />
          </div>
          <CookPanel />
          <footer className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>{t.footer}</span>
            <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
              {t.privacy}
            </Link>
          </footer>
        </motion.main>
      ) : (
        <main className="mx-auto flex max-w-[1180px] flex-col gap-[18px] px-4 pt-[18px]" aria-busy="true">
          <div className="skeleton h-10 w-64 rounded-lg" />
          <div className="skeleton h-40 rounded-2xl" />
          <div className="grid gap-[18px] md:grid-cols-2">
            <div className="skeleton h-96 rounded-2xl" />
            <div className="skeleton h-96 rounded-2xl" />
          </div>
        </main>
      )}
      <MobileNav />
      <Toast />
      <AccountSheet syncAvailable={syncAvailable} />
      <AlertsSheet />
      <ItemSheet />
    </>
  );
}
