"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CATALOG } from "@/lib/catalog";
import { STR } from "@/lib/i18n";
import * as K from "@/lib/kitchen";
import { coursesOf, pickRecipes, surprise, type MatchContext } from "@/lib/matcher";
import { parseText } from "@/lib/parser";
import { diffKitchen, mergeOutbox, type Op } from "@/lib/sync-rows";
import { getIdMap } from "@/lib/sync";
import { amountText, nameOf, unitOf } from "@/lib/units";
import { aiToCards, buildRequest } from "@/lib/ai/map";
import type { AiRecipe } from "@/lib/ai/schema";
import { todayISO } from "@/lib/dates";
import type { BatchDates, Batch, KitchenData, Lang, Parsed, Prefs, RecipeCardData, Region } from "@/lib/types";

export type SyncState = "local" | "syncing" | "synced" | "offline" | "error";

interface ToastAction {
  label: string;
  run: () => void;
}
interface Toast {
  id: number;
  msg: string;
  actions: ToastAction[];
}

interface AiState {
  mode: "local" | "ai";
  cards: RecipeCardData[] | null;
  loading: boolean;
  error: boolean;
  stale: boolean;
}

interface KitchenStore {
  /* persisted */
  data: KitchenData;
  prefs: Prefs;
  outbox: Op[];
  syncedHousehold: string | null;
  /** Local edits were made while signed in but not connected; merge them in on the next sync. */
  needsReconcile: boolean;

  /* session only */
  /** Bumped on every local change, so a slow pull can tell it would overwrite newer edits. */
  rev: number;
  undoSnap: KitchenData | null;
  fresh: string[];
  toast: Toast | null;
  ai: AiState;
  aiEnabled: boolean;
  household: { id: string; joinCode: string } | null;
  email: string | null;
  sync: SyncState;

  /* prefs */
  setLang: (l: Lang) => void;
  setRegion: (r: Region) => void;
  setStaples: (on: boolean) => void;
  setTarget: (t: Prefs["target"]) => void;
  setAlertDays: (n: number) => void;
  setNotify: (on: boolean) => void;
  setCuisine: (c: string) => void;
  setCourseGroup: (g: string) => void;
  /** Recipe id shown as the "Surprise me" pick, or null. */
  surpriseId: string | null;
  surpriseMe: () => void;
  clearSurprise: () => void;

  /* kitchen */
  submitText: (text: string, dates?: BatchDates) => void;
  quickAdd: (cid: string, dates?: BatchDates) => void;
  step: (where: "fridge" | "list", id: string, dir: 1 | -1) => void;
  setQty: (where: "fridge" | "list", id: string, qty: number) => void;
  useUp: (id: string) => void;
  toList: (id: string) => void;
  remove: (id: string) => void;
  removeFromList: (id: string) => void;
  bought: (id: string) => void;
  cooked: (card: RecipeCardData) => void;
  addMissing: (card: RecipeCardData) => void;
  updateBatch: (itemId: string, batchId: string, patch: Partial<Omit<Batch, "id">>) => void;
  addBatch: (itemId: string, qty: number, dates: BatchDates) => void;
  removeBatch: (itemId: string, batchId: string) => void;
  throwAway: (itemId: string) => void;
  undo: () => void;

  /* recipes */
  cards: () => RecipeCardData[];
  askAi: () => Promise<void>;
  backToLocal: () => void;

  /* ui + sync plumbing */
  showToast: (msg: string, actions?: ToastAction[]) => void;
  hideToast: () => void;
  /** Replace local data with the server's. With `ifRev`, only if nothing changed locally since then. */
  applyRemote: (data: KitchenData, ifRev?: number) => boolean;
  setSession: (s: Partial<Pick<KitchenStore, "household" | "email" | "sync" | "syncedHousehold" | "outbox" | "aiEnabled" | "needsReconcile">>) => void;
  onCommit: (() => void) | null;
}

const t = () => STR[useKitchen.getState().prefs.lang];
const DEFAULT_PREFS: Prefs = { lang: "en", region: "uk", staples: true, target: "fridge", alertDays: 2, notify: false, cuisine: "all", courseGroup: "meals" };

/** Dates from the date fields apply unless the text itself gave some ("milk use by 3/10"). */
function mergeDates(x: BatchDates, fields?: BatchDates): BatchDates | undefined {
  const d: BatchDates = {};
  for (const k of ["purchased", "useBy", "bestBefore"] as const) {
    const v = x[k] || fields?.[k];
    if (v) d[k] = v;
  }
  return d.purchased || d.useBy || d.bestBefore ? d : undefined;
}
let toastSeq = 0;

export const useKitchen = create<KitchenStore>()(
  persist(
    (set, get) => {
      const ctx = (): MatchContext => ({
        items: get().data.items,
        region: get().prefs.region,
        staples: get().prefs.staples,
        today: todayISO(),
        alertDays: get().prefs.alertDays,
        cuisine: get().prefs.cuisine as MatchContext["cuisine"],
        courses: coursesOf(get().prefs.courseGroup),
      });
      const nm = (x: Parsed) => nameOf(x, get().prefs.lang);

      /** Apply a change: keep an undo snapshot, highlight what changed, queue it for sync. */
      function commit(next: KitchenData, opts: { bought?: string[]; toast?: string; undo?: boolean } = {}) {
        const prev = get().data;
        const changed = [...next.items, ...next.list].filter((x) => {
          const old = [...prev.items, ...prev.list].find((o) => o.id === x.id);
          return !old || old.updatedAt !== x.updatedAt;
        });
        let outbox = get().outbox;
        const hh = get().household;
        const ids = getIdMap();
        let needsReconcile = get().needsReconcile;
        if (hh && ids) outbox = mergeOutbox(outbox, diffKitchen(prev, next, new Set(opts.bought ?? []), hh.id, ids, get().prefs.region));
        // Signed in on this device but not connected yet (offline start, or sync still starting):
        // remember to send these edits once the connection is back.
        else if (get().syncedHousehold) needsReconcile = true;
        const ai = get().ai;
        set({
          data: next,
          rev: get().rev + 1,
          needsReconcile,
          undoSnap: prev,
          fresh: changed.map((c) => c.id),
          outbox,
          ai: ai.mode === "ai" ? { ...ai, mode: "local", stale: true } : ai,
        });
        if (opts.toast) get().showToast(opts.toast, opts.undo === false ? [] : [{ label: t().undo, run: () => get().undo() }]);
        get().onCommit?.();
      }

      const amountLabel = (x: Parsed) => (typeof x.qty === "number" ? ` ${amountText(x.qty, x.u ?? (x.cid ? CATALOG[x.cid].u : "pc"), get().prefs.lang)}` : "");

      async function classify(unknown: Parsed[]) {
        if (!get().aiEnabled || !unknown.length) return;
        try {
          const res = await fetch("/api/classify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items: unknown.map((u) => u.name!).slice(0, 20) }),
          });
          if (!res.ok) return;
          const body = (await res.json()) as { items: { input: string; en: string; th: string; category: Parsed["cat"] }[] };
          const d = get().data;
          const fix = <T extends Parsed>(x: T): T => {
            if (x.cid || !x.name) return x;
            const hit = body.items.find((r) => r.input.toLowerCase() === x.name!.toLowerCase());
            return hit ? { ...x, en: hit.en, th: hit.th, cat: hit.category, updatedAt: Date.now() } : x;
          };
          // Labelling is not a user action: keep the Undo from the add that triggered it.
          const keep = get().undoSnap;
          commit({ ...d, items: d.items.map(fix), list: d.list.map(fix) });
          set({ undoSnap: keep });
        } catch {
          /* labelling is a nice-to-have */
        }
      }

      return {
        data: K.sampleKitchen(),
        prefs: DEFAULT_PREFS,
        outbox: [],
        syncedHousehold: null,
        needsReconcile: false,
        rev: 0,
        undoSnap: null,
        fresh: [],
        toast: null,
        ai: { mode: "local", cards: null, loading: false, error: false, stale: false },
        aiEnabled: false,
        household: null,
        email: null,
        sync: "local",
        onCommit: null,

        setLang: (lang) => set((s) => ({ prefs: { ...s.prefs, lang } })),
        setRegion: (region) => set((s) => ({ prefs: { ...s.prefs, region }, ai: { ...s.ai, mode: "local" } })),
        setStaples: (staples) => set((s) => ({ prefs: { ...s.prefs, staples }, ai: { ...s.ai, mode: "local" } })),
        setTarget: (target) => set((s) => ({ prefs: { ...s.prefs, target } })),
        setAlertDays: (alertDays) => set((s) => ({ prefs: { ...s.prefs, alertDays } })),
        setNotify: (notify) => set((s) => ({ prefs: { ...s.prefs, notify } })),
        setCuisine: (cuisine) => set((s) => ({ prefs: { ...s.prefs, cuisine }, surpriseId: null, ai: { ...s.ai, mode: "local" } })),
        setCourseGroup: (courseGroup) => set((s) => ({ prefs: { ...s.prefs, courseGroup }, surpriseId: null, ai: { ...s.ai, mode: "local" } })),
        surpriseId: null,
        surpriseMe: () => {
          const pick = surprise(ctx(), Math.random, get().surpriseId ?? undefined);
          set({ surpriseId: pick?.id ?? null });
        },
        clearSurprise: () => set({ surpriseId: null }),

        submitText: (text, dates) => {
          const found = parseText(text);
          if (!found.length) return get().showToast(t().t_nothing);
          let d = get().data;
          const names: string[] = [];
          const dups: Parsed[] = [];
          for (const x of found) {
            if (get().prefs.target === "fridge") {
              d = K.addToFridge(d, x, { dates: mergeDates(x, dates) }).data;
              names.push(nm(x) + amountLabel(x));
            } else {
              const r = K.addToList(d, x);
              if (r.result === "ok") {
                d = r.data;
                names.push(nm(x) + amountLabel(x));
              } else if (r.result === "dup") dups.push(x);
            }
          }
          if (names.length) {
            commit(d, { toast: (get().prefs.target === "fridge" ? t().t_addedF : t().t_listed)(names.join(", ")) });
          } else if (dups.length) {
            get().showToast(t().t_dup(nm(dups[0])), [
              {
                label: t().addAnyway,
                run: () => {
                  let dd = get().data;
                  for (const x of dups) dd = K.addToList(dd, x, { force: true }).data;
                  commit(dd);
                },
              },
            ]);
          }
          void classify(found.filter((x) => !x.cid));
        },

        quickAdd: (cid, dates) => {
          const c = CATALOG[cid];
          const d = get().data;
          if (get().prefs.target === "fridge") {
            const has = K.findItem(d, { cid });
            const r = K.addToFridge(d, has && has.qty > 0 ? { cid, qty: c.pack } : { cid }, { dates: mergeDates({}, dates) });
            commit(r.data, { toast: t().t_addedF(`${nm({ cid })} ${amountText(c.pack, c.u, get().prefs.lang)}`) });
            return;
          }
          const r = K.addToList(d, { cid });
          if (r.result === "dup")
            return get().showToast(t().t_dup(nm({ cid })), [{ label: t().addAnyway, run: () => commit(K.addToList(get().data, { cid }, { force: true }).data) }]);
          if (r.result === "onlist") return get().showToast(t().t_onlist(nm({ cid })));
          commit(r.data, { toast: t().t_listed(nm({ cid })) });
        },

        step: (where, id, dir) => {
          const r = K.stepQty(get().data, where, id, dir);
          commit(r.data, r.wentOut ? { toast: t().t_out(nm(r.wentOut)) } : {});
        },
        setQty: (where, id, qty) => {
          const r = K.setQty(get().data, where, id, qty);
          commit(r.data, r.wentOut ? { toast: t().t_out(nm(r.wentOut)) } : {});
        },
        useUp: (id) => {
          const r = K.useUp(get().data, id);
          commit(r.data, r.wentOut ? { toast: t().t_out(nm(r.wentOut)) } : {});
        },
        toList: (id) => {
          const it = get().data.items.find((i) => i.id === id);
          if (!it) return;
          const r = K.addToList(get().data, it, { force: true });
          if (r.result === "onlist") return get().showToast(t().t_onlist(nm(it)));
          commit(r.data, { toast: t().t_listed(nm(it)) });
        },
        remove: (id) => {
          const it = get().data.items.find((i) => i.id === id);
          if (it) commit(K.removeItem(get().data, id), { toast: t().t_removed(nm(it)) });
        },
        removeFromList: (id) => {
          const it = get().data.list.find((i) => i.id === id);
          if (it) commit(K.removeListItem(get().data, id), { toast: t().t_removed(nm(it)) });
        },
        bought: (id) => {
          const r = K.markBought(get().data, id);
          if (!r.item) return;
          commit(r.data, { bought: [id], toast: t().t_bought(`${nm(r.item)} ${amountText(r.item.qty, unitOf(r.item), get().prefs.lang)}`) });
        },
        cooked: (card) => {
          const title = (get().prefs.lang === "th" ? card.title_th : card.title_en) || card.title_en || "";
          const r = K.cook(get().data, card, { region: get().prefs.region, staples: get().prefs.staples }, title);
          const outs = r.outs.map((o) => nm(o));
          commit(r.data, { toast: t().t_cooked + (outs.length ? " " + t().t_listed(outs.join(", ")) : "") });
        },
        addMissing: (card) => {
          const wanted = card.missingAll?.length ? card.missingAll : card.missing ? [card.missing] : [];
          if (!wanted.length) return;
          const title = (get().prefs.lang === "th" ? card.title_th : card.title_en) || "";
          let d = get().data;
          const added: string[] = [];
          for (const m of wanted) {
            const r = K.addToList(d, m, { from: title, force: true });
            if (r.result === "ok") {
              d = r.data;
              added.push(nm(m));
            }
          }
          if (!added.length) return get().showToast(t().t_onlist(wanted.map(nm).join(", ")));
          // Adding missing items doesn't change what can be cooked, so keep the current ideas on screen.
          const ai = get().ai;
          commit(d, { toast: t().t_listed(added.join(", ")) });
          if (ai.mode === "ai") set({ ai: { ...ai, stale: false } });
        },
        updateBatch: (itemId, batchId, patch) => {
          const r = K.updateBatch(get().data, itemId, batchId, patch);
          commit(r.data, r.wentOut ? { toast: t().t_out(nm(r.wentOut)) } : {});
        },
        addBatch: (itemId, qty, dates) => commit(K.addBatch(get().data, itemId, qty, dates).data),
        removeBatch: (itemId, batchId) => {
          const r = K.removeBatch(get().data, itemId, batchId);
          commit(r.data, r.wentOut ? { toast: t().t_out(nm(r.wentOut)) } : {});
        },
        throwAway: (itemId) => {
          const it = get().data.items.find((i) => i.id === itemId);
          if (!it) return;
          const r = K.throwAwayExpired(get().data, itemId);
          if (r.discarded > 0) commit(r.data, { toast: r.wentOut ? t().t_threw(nm(it)) : t().t_threwSome(nm(it)) });
        },
        undo: () => {
          const snap = get().undoSnap;
          if (!snap) return;
          commit(snap, { undo: false });
          set({ undoSnap: null, toast: null });
        },

        cards: () => {
          const ai = get().ai;
          return ai.mode === "ai" && ai.cards ? ai.cards : pickRecipes(ctx());
        },
        askAi: async () => {
          if (get().ai.loading) return;
          set({ ai: { ...get().ai, loading: true, error: false, stale: false } });
          try {
            const res = await fetch("/api/recipes", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(buildRequest(ctx())),
            });
            if (!res.ok) throw new Error(String(res.status));
            const body = (await res.json()) as { recipes: AiRecipe[] };
            if (!body.recipes?.length) throw new Error("empty");
            set({ ai: { mode: "ai", cards: aiToCards(body.recipes, ctx()), loading: false, error: false, stale: false } });
          } catch {
            set({ ai: { ...get().ai, loading: false, error: true } });
          }
        },
        backToLocal: () => set((s) => ({ ai: { ...s.ai, mode: "local", stale: false } })),

        showToast: (msg, actions = []) => set({ toast: { id: ++toastSeq, msg, actions } }),
        hideToast: () => set({ toast: null }),
        applyRemote: (data, ifRev) => {
          if (ifRev !== undefined && (get().rev !== ifRev || get().outbox.length || get().needsReconcile)) return false;
          set({ data: K.upgradeData(data), undoSnap: null });
          return true;
        },
        setSession: (s) => set(s),
      };
    },
    {
      name: "cook-till-empty",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ data: s.data, prefs: s.prefs, outbox: s.outbox, syncedHousehold: s.syncedHousehold, needsReconcile: s.needsReconcile }),
      // Saved state from older versions lacks newer settings and purchase dates: fill them in.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<KitchenStore>;
        return {
          ...current,
          ...p,
          prefs: { ...DEFAULT_PREFS, ...(p.prefs ?? {}) },
          data: p.data ? K.upgradeData(p.data) : current.data,
        };
      },
    },
  ),
);
