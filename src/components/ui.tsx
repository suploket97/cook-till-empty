"use client";

import { STR } from "@/lib/i18n";
import { useKitchen } from "@/store/kitchen";

export const useLang = () => useKitchen((s) => s.prefs.lang);
export const useT = () => STR[useLang()];

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Segmented control (region, language, add-to target). */
export function Seg<V extends string>({
  label,
  value,
  options,
  onChange,
  ariaLabel,
}: {
  label?: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex flex-wrap gap-0.5 rounded-[10px] bg-surface-2 p-[3px]">
      {label && <span className="self-center px-2 text-[11px] uppercase tracking-[0.06em] text-muted">{label}</span>}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-lg px-3 py-1 text-[13px] font-medium transition-colors",
            o.value === value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const btn =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[13.5px] font-medium transition active:scale-[.97] hover:border-muted disabled:opacity-60";
export const btnGhost =
  "inline-flex items-center justify-center rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink";
export const panel = "rounded-2xl border border-line bg-surface";
