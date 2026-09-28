"use client";

import { CalendarClock } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { expiryPhrase, type ExpiryInfo } from "@/lib/expiry";
import { cx, useLang, useT } from "./ui";

export const LEVEL_TEXT: Record<ExpiryInfo["level"], string> = {
  expired: "text-bad",
  today: "text-bad",
  soon: "text-warn",
  past_best: "text-turmeric",
  ok: "text-muted",
};

/** "Use by 29 Sep · tomorrow" — coloured by urgency, "~" when the date is an estimate. */
export function ExpiryBadge({ info, compact }: { info: ExpiryInfo; compact?: boolean }) {
  const t = useT();
  const lang = useLang();
  const label = info.kind === "use_by" ? t.useBy : t.bestBefore;
  const near = info.level !== "ok";
  return (
    <span
      className={cx("inline-flex items-center gap-1 whitespace-nowrap", LEVEL_TEXT[info.level], near && "font-semibold")}
      title={info.est ? t.estShort : undefined}
    >
      <CalendarClock size={12} aria-hidden />
      {near ? expiryPhrase(info, lang) : `${compact ? "" : label + " "}${info.est ? "~" : ""}${formatDate(info.date, lang)}`}
    </span>
  );
}
