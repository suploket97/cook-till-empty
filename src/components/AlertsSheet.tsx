"use client";

import { Bell, BellOff, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { disableNotifications, enableNotifications, pushAvailable, pushState, sendTestPush, syncPushPrefs, type PushState } from "@/lib/push/client";
import { useKitchen } from "@/store/kitchen";
import { useUi } from "@/store/ui";
import { Sheet } from "./Sheet";
import { Seg, btn, cx, useT } from "./ui";

/** How early to warn, and notifications on this device (daily push when signed in, otherwise on opening the app). */
export function AlertsSheet() {
  const t = useT();
  const open = useUi((s) => s.sheet === "alerts");
  const close = () => useUi.getState().openSheet(null);
  const prefs = useKitchen((s) => s.prefs);
  const signedIn = useKitchen((s) => Boolean(s.household));
  const { setAlertDays, setNotify } = useKitchen.getState();
  const [state, setState] = useState<PushState>("off");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const daily = pushAvailable() && signedIn;

  useEffect(() => {
    if (open) pushState().then(setState).catch(() => setState("unsupported"));
  }, [open]);

  async function turnOn() {
    setBusy(true);
    setMsg(null);
    try {
      await enableNotifications({ lang: prefs.lang, alertDays: prefs.alertDays, signedIn });
      setNotify(true);
      setState(await pushState());
    } catch (e) {
      const reason = (e as Error).message;
      setMsg(reason === "dev" ? t.notifyDev : reason === "denied" ? t.notifyDenied : t.testFail);
      setState(await pushState().catch(() => "off" as PushState));
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    await disableNotifications().catch(() => {});
    setNotify(false);
    setState("off");
    setBusy(false);
  }

  const isOn = prefs.notify && state === "on";

  return (
    <Sheet open={open} onClose={close} title={t.alerts}>
      <p className="text-[13px] text-muted">{t.dateRules}</p>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{t.warnDays}</span>
        <Seg
          ariaLabel={t.warnDays}
          value={String(prefs.alertDays)}
          onChange={(v) => {
            setAlertDays(Number(v));
            void syncPushPrefs(prefs.lang, Number(v));
          }}
          options={[0, 1, 2, 3, 5].map((n) => ({ value: String(n), label: t.daysBefore(n) }))}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <p className="text-sm font-medium">{t.notifyTitle}</p>
        {state === "unsupported" && <p className="text-sm text-muted">{t.notifyUnsupported}</p>}
        {state === "ios-install" && <p className="text-sm text-muted">{t.notifyIOS}</p>}
        {state === "denied" && <p className="text-sm text-bad">{t.notifyDenied}</p>}
        {(state === "on" || state === "off") && (
          <>
            <p className="text-sm text-muted">{daily ? t.notifyPushHelp : t.notifyLocalHelp}</p>
            <div className="flex flex-wrap gap-2">
              {isOn ? (
                <>
                  <span className={cx(btn, "border-ok text-ok")} aria-live="polite">
                    <Bell size={15} />
                    {t.notifyIsOn}
                  </span>
                  <button type="button" className={btn} disabled={busy} onClick={() => void turnOff()}>
                    <BellOff size={15} />
                    {t.turnOff}
                  </button>
                  {daily && (
                    <button
                      type="button"
                      className={btn}
                      disabled={busy}
                      onClick={async () => setMsg((await sendTestPush(prefs.lang).catch(() => false)) ? t.testSent : t.testFail)}
                    >
                      <Send size={15} />
                      {t.sendTest}
                    </button>
                  )}
                </>
              ) : (
                <button type="button" className={cx(btn, "border-accent bg-accent text-accent-ink hover:border-accent")} disabled={busy} onClick={() => void turnOn()}>
                  <Bell size={15} />
                  {t.turnOn}
                </button>
              )}
            </div>
          </>
        )}
        {msg && <p className="text-sm text-accent">{msg}</p>}
      </div>
    </Sheet>
  );
}
