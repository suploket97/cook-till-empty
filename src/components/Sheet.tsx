"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect } from "react";
import { btnGhost, cx, useT } from "./ui";

/** Bottom sheet on phones, centred dialog on larger screens. Closes on Escape or a tap outside. */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className={cx(
              "flex max-h-[90dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl",
              wide ? "max-w-xl" : "max-w-md",
            )}
          >
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-semibold">{title}</h2>
              <button type="button" onClick={onClose} className={cx(btnGhost, "ml-auto")} aria-label={t.close}>
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
