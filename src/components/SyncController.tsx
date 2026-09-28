"use client";

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { ensureHousehold, loadIdMap, pullKitchen, pushOps, subscribeKitchen } from "@/lib/sync";
import { diffKitchen, mergeOutbox } from "@/lib/sync-rows";
import type { KitchenData } from "@/lib/types";
import { useKitchen } from "@/store/kitchen";

const EMPTY: KitchenData = { items: [], list: [], log: [] };
let flushing = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Push the outbox. Ops added while a push is in flight are kept for the next round. */
export async function flushNow(): Promise<boolean> {
  const sb = getSupabase();
  const { household, outbox, setSession } = useKitchen.getState();
  if (!sb || !household || !outbox.length || flushing) return !outbox.length;
  flushing = true;
  setSession({ sync: "syncing", outbox: [] });
  const failed = await pushOps(sb, outbox).catch(() => outbox);
  flushing = false;
  const merged = mergeOutbox(failed, useKitchen.getState().outbox);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  setSession({ outbox: merged, sync: failed.length ? (offline ? "offline" : "error") : "synced" });
  if (!failed.length && merged.length) scheduleFlush();
  return !failed.length;
}

function scheduleFlush(ms = 600) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flushNow(), ms);
}

/** Refresh from the server, but never over local changes that haven't been sent yet. */
async function pull() {
  const sb = getSupabase();
  const hh = useKitchen.getState().household;
  if (!sb || !hh) return;
  if (useKitchen.getState().outbox.length && !(await flushNow())) return;
  try {
    const remote = await pullKitchen(sb, hh.id);
    if (!useKitchen.getState().outbox.length) useKitchen.getState().applyRemote(remote);
  } catch {
    useKitchen.getState().setSession({ sync: navigator.onLine ? "error" : "offline" });
  }
}

/**
 * Wires the local store to Supabase: sign-in state, first sync for a household,
 * pushing changes, live updates from the rest of the household, and reconnects.
 */
export function SyncController() {
  useEffect(() => {
    // Rehydrate the saved kitchen (skipped during SSR to avoid a hydration mismatch).
    void useKitchen.persist.rehydrate();

    fetch("/api/ai-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => useKitchen.getState().setSession({ aiEnabled: Boolean(s?.enabled) }))
      .catch(() => {});

    const sb = getSupabase();
    if (!sb) return;

    let unsubscribeRealtime: (() => void) | null = null;
    let pullTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedPull = () => {
      if (pullTimer) clearTimeout(pullTimer);
      pullTimer = setTimeout(() => void pull(), 400);
    };

    useKitchen.setState({ onCommit: () => scheduleFlush() });

    async function start(email: string | null) {
      const st = useKitchen.getState();
      st.setSession({ email, sync: "syncing" });
      try {
        const ids = await loadIdMap(sb!);
        const hh = await ensureHousehold(sb!);
        st.setSession({ household: { id: hh.id, joinCode: hh.join_code } });

        if (useKitchen.getState().syncedHousehold !== hh.id) {
          // First time this device meets this household: upload local data if the household is empty,
          // otherwise the household's shared kitchen wins.
          const remote = await pullKitchen(sb!, hh.id);
          const remoteEmpty = !remote.items.length && !remote.list.length && !remote.log.length;
          if (remoteEmpty) {
            const s = useKitchen.getState();
            const ops = diffKitchen(EMPTY, s.data, new Set(), hh.id, ids, s.prefs.region);
            s.setSession({ outbox: mergeOutbox([], ops) });
            await flushNow();
          } else {
            useKitchen.getState().setSession({ outbox: [] });
            useKitchen.getState().applyRemote(remote);
          }
          useKitchen.getState().setSession({ syncedHousehold: hh.id, sync: "synced" });
        } else {
          await pull();
          useKitchen.getState().setSession({ sync: "synced" });
        }

        unsubscribeRealtime?.();
        unsubscribeRealtime = subscribeKitchen(sb!, hh.id, debouncedPull);
      } catch {
        useKitchen.getState().setSession({ sync: navigator.onLine ? "error" : "offline" });
      }
    }

    function stop() {
      unsubscribeRealtime?.();
      unsubscribeRealtime = null;
      // Keep the kitchen on this device; just stop syncing.
      useKitchen.getState().setSession({ household: null, email: null, sync: "local", outbox: [], syncedHousehold: null });
    }

    sb.auth.getUser().then(({ data }) => {
      if (data.user) void start(data.user.email ?? null);
    });
    const { data: authSub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        if (useKitchen.getState().household) return;
        void start(session.user.email ?? null);
      }
      if (event === "SIGNED_OUT") stop();
    });

    const onOnline = () => void pull();
    const onVisible = () => document.visibilityState === "visible" && void pull();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      authSub.subscription.unsubscribe();
      unsubscribeRealtime?.();
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      useKitchen.setState({ onCommit: null });
    };
  }, []);

  return null;
}
