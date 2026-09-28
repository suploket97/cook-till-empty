"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { useKitchen } from "@/store/kitchen";

export function Toast() {
  const toast = useKitchen((s) => s.toast);
  const hide = useKitchen((s) => s.hideToast);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(hide, 4500);
    return () => clearTimeout(id);
  }, [toast, hide]);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(20px+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 max-md:bottom-[calc(76px+env(safe-area-inset-bottom))]">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex max-w-full items-center gap-3 rounded-xl bg-ink py-2.5 pl-4 pr-3 text-sm text-bg shadow-[0_10px_30px_-10px_rgba(0,0,0,.4)]"
          >
            <span>{toast.msg}</span>
            {toast.actions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => {
                  hide();
                  a.run();
                }}
                className="rounded-md px-1.5 py-1 font-semibold text-accent-soft hover:underline"
              >
                {a.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
