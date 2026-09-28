"use client";

import { AnimatePresence, motion } from "motion/react";
import { Copy, X } from "lucide-react";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { disableNotifications } from "@/lib/push/client";
import { joinHousehold } from "@/lib/sync";
import { useKitchen } from "@/store/kitchen";
import { useUi } from "@/store/ui";
import { btn, btnGhost, cx, useT } from "./ui";

export function AccountSheet({ syncAvailable }: { syncAvailable: boolean }) {
  const t = useT();
  const open = useUi((s) => s.sheet === "account");
  const onClose = () => useUi.getState().openSheet(null);
  const email = useKitchen((s) => s.email);
  const household = useKitchen((s) => s.household);
  const [addr, setAddr] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb || !addr.trim()) return;
    setBusy(true);
    const { error } = await sb.auth.signInWithOtp({ email: addr.trim(), options: { emailRedirectTo: `${location.origin}/auth/callback` } });
    setBusy(false);
    setMsg(error ? error.message : t.linkSent(addr.trim()));
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb || !code.trim()) return;
    setBusy(true);
    try {
      const hh = await joinHousehold(sb, code.trim());
      // Treat the joined kitchen as already known so the next start pulls it instead of uploading this device's data.
      useKitchen.getState().setSession({ syncedHousehold: hh.id, outbox: [], needsReconcile: false });
      setMsg(t.joined);
      setTimeout(() => location.reload(), 600);
    } catch {
      setMsg(t.joinFail);
      setBusy(false);
    }
  }

  const field = "min-w-0 flex-1 rounded-[10px] border-[1.5px] border-line bg-bg px-3 py-2 focus:border-accent focus:outline-none";

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-h"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-surface p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl"
          >
            <div className="flex items-center">
              <h2 id="account-h" className="font-display text-lg font-semibold">
                {t.account}
              </h2>
              <button type="button" onClick={onClose} className={cx(btnGhost, "ml-auto")} aria-label={t.close}>
                <X size={18} />
              </button>
            </div>

            {!syncAvailable && <p className="text-sm text-muted">{t.notConfigured}</p>}

            {syncAvailable && !email && (
              <form onSubmit={sendLink} className="flex flex-col gap-2.5">
                <p className="font-medium">{t.signIn}</p>
                <p className="text-sm text-muted">{t.signInHelp}</p>
                <div className="flex gap-2">
                  <input type="email" required value={addr} onChange={(e) => setAddr(e.target.value)} placeholder={t.email} aria-label={t.email} className={field} />
                  <button type="submit" className={btn} disabled={busy}>
                    {t.sendLink}
                  </button>
                </div>
              </form>
            )}

            {syncAvailable && email && (
              <div className="flex flex-col gap-4">
                <p className="text-sm">
                  <span className="text-muted">{t.signedInAs}</span> <b className="font-semibold">{email}</b>
                </p>
                {household && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted">{t.household}</p>
                    <p className="text-sm text-muted">{t.joinCode}</p>
                    <div className="flex items-center gap-2">
                      <code className="num select-all rounded-lg bg-surface-2 px-3 py-1.5 text-lg tracking-[0.2em]">{household.joinCode}</code>
                      <button
                        type="button"
                        className={btnGhost}
                        aria-label="Copy"
                        onClick={() => navigator.clipboard?.writeText(household.joinCode).catch(() => {})}
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                )}
                <form onSubmit={join} className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium">{t.joinOther}</p>
                  <div className="flex gap-2">
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      placeholder="ABC123"
                      aria-label={t.joinOther}
                      className={cx(field, "num uppercase tracking-[0.2em]")}
                    />
                    <button type="submit" className={btn} disabled={busy}>
                      {t.join}
                    </button>
                  </div>
                </form>
                <button type="button" className={cx(btn, "self-start")} onClick={async () => {
                    // Stop this device's daily alerts for the household being left.
                    await disableNotifications().catch(() => {});
                    useKitchen.getState().setNotify(false);
                    await getSupabase()?.auth.signOut();
                  }}>
                  {t.signOut}
                </button>
              </div>
            )}

            {msg && <p className="text-sm text-accent">{msg}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
