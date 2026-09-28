"use client";

import { Dices, RefreshCw, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { todayISO } from "@/lib/dates";
import { cardFor, coursesOf, moreRecipes, pickRecipes, recipePool, type MatchContext } from "@/lib/matcher";
import { COURSE_GROUPS, CUISINES } from "@/lib/recipes";
import type { RecipeCardData } from "@/lib/types";
import { useKitchen } from "@/store/kitchen";
import { RecipeCard } from "./RecipeCard";
import { btn, btnGhost, cx, panel, useLang, useT } from "./ui";

const GRID = "grid items-start gap-3.5 md:grid-cols-2 lg:grid-cols-3";

/** A titled group of extra dishes, three at first with "Show more". */
function MoreGroup({ title, cards }: { title: string; cards: RecipeCardData[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!cards.length) return null;
  const shown = open ? cards : cards.slice(0, 3);
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted">{title}</h3>
      <div className={GRID}>
        {shown.map((c) => (
          <RecipeCard key={c.id} card={c} />
        ))}
      </div>
      {cards.length > 3 && (
        <button type="button" className={cx(btn, "self-start")} onClick={() => setOpen((v) => !v)}>
          {open ? t.showLess : t.showMore}
        </button>
      )}
    </div>
  );
}

export function CookPanel() {
  const t = useT();
  const lang = useLang();
  const items = useKitchen((s) => s.data.items);
  const prefs = useKitchen((s) => s.prefs);
  const ai = useKitchen((s) => s.ai);
  const aiEnabled = useKitchen((s) => s.aiEnabled);
  const surpriseId = useKitchen((s) => s.surpriseId);
  const { askAi, backToLocal, setCuisine, setCourseGroup, surpriseMe, clearSurprise } = useKitchen.getState();

  const ctx: MatchContext = useMemo(
    () => ({
      items,
      region: prefs.region,
      staples: prefs.staples,
      today: todayISO(),
      alertDays: prefs.alertDays,
      cuisine: prefs.cuisine as MatchContext["cuisine"],
      courses: coursesOf(prefs.courseGroup),
    }),
    [items, prefs.region, prefs.staples, prefs.alertDays, prefs.cuisine, prefs.courseGroup],
  );
  const poolSize = useMemo(() => recipePool(ctx).length, [ctx]);
  const local = useMemo(() => pickRecipes(ctx), [ctx]);
  const more = useMemo(() => moreRecipes(ctx, local.map((c) => c.id!).filter(Boolean)), [ctx, local]);
  const pick = useMemo(() => (surpriseId ? cardFor(ctx, surpriseId) : null), [ctx, surpriseId]);
  const cards = ai.mode === "ai" && ai.cards ? ai.cards : local;

  return (
    <section id="cook" aria-labelledby="cook-h" className={cx(panel, "flex scroll-mt-4 flex-col gap-3.5 px-4 pb-4 pt-[18px]")}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2.5">
        <div>
          <h2 id="cook-h" className="font-display text-[22px] font-bold tracking-[-0.01em]">
            {t.cookTitle}
          </h2>
          <p className="mt-0.5 max-w-[62ch] text-sm text-muted">{t.cookSub}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            {ai.mode === "ai" && <Sparkles size={13} />}
            {ai.mode === "ai" ? t.srcAI : t.libraryCount(poolSize)}
          </span>
          {aiEnabled && (
            <>
              <button type="button" className={btn} disabled={ai.loading} onClick={() => void askAi()}>
                {ai.mode === "ai" ? <RefreshCw size={15} /> : <Sparkles size={15} />}
                {ai.loading ? t.aiLoading : t.aiBtn}
              </button>
              {ai.mode === "ai" && (
                <button type="button" className={cx(btn, "border-transparent bg-transparent text-muted")} onClick={backToLocal}>
                  {t.aiBack}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filters: what kind of food, and which part of the meal */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t.cuisine} className="inline-flex flex-wrap gap-0.5 rounded-[10px] bg-surface-2 p-[3px]">
          {COURSE_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={prefs.courseGroup === g.id}
              onClick={() => setCourseGroup(g.id)}
              className={cx(
                "rounded-lg px-3 py-1 text-[13px] font-medium transition-colors",
                prefs.courseGroup === g.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
              )}
            >
              {g[lang]}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-[13px] text-muted">
          <span className="sr-only">{t.cuisine}</span>
          <select
            id="cuisine-filter"
            value={prefs.cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            className="rounded-[10px] border-[1.5px] border-line bg-surface px-2.5 py-1.5 text-[13.5px] text-ink focus:border-accent focus:outline-none"
          >
            <option value="all">{t.anyCuisine}</option>
            {CUISINES.map((c) => (
              <option key={c.id} value={c.id}>
                {c[lang]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={btn} onClick={surpriseMe}>
          <Dices size={15} />
          {surpriseId ? t.anotherOne : t.surpriseMe}
        </button>
      </div>

      {pick && (
        <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-accent/60 p-3">
          <div className="flex items-center gap-2">
            <h3 className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-accent">
              <Dices size={14} />
              {t.surprisePick}
            </h3>
            <button type="button" className={cx(btnGhost, "ml-auto")} aria-label={t.close} onClick={clearSurprise}>
              <X size={16} />
            </button>
          </div>
          <div className={GRID}>
            <RecipeCard card={pick} />
          </div>
        </div>
      )}

      {ai.error && <p className="text-[13px] text-bad">{t.aiErr}</p>}
      {ai.stale && !ai.error && <p className="text-[13px] text-muted">{t.stale}</p>}
      {poolSize === 0 ? (
        <p className="text-sm text-muted">{t.noneInFilter}</p>
      ) : (
        <div className={GRID}>
          {ai.loading
            ? [0, 1, 2].map((i) => <div key={i} className="skeleton h-64 rounded-[14px]" />)
            : cards.map((c, i) => <RecipeCard key={`${c.kind}-${c.id ?? c.title_en ?? i}`} card={c} />)}
        </div>
      )}

      {ai.mode !== "ai" && (
        <>
          <MoreGroup title={t.moreReady(more.ready.length)} cards={more.ready} />
          <MoreGroup title={t.moreNearly(more.nearly.length)} cards={more.nearly} />
        </>
      )}
    </section>
  );
}
