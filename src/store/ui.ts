"use client";

import { create } from "zustand";

/** Which sheet is open. Kept apart from the kitchen store so it is never saved or synced. */
interface UiStore {
  editingItem: string | null;
  sheet: "account" | "alerts" | null;
  editItem: (id: string | null) => void;
  openSheet: (s: UiStore["sheet"]) => void;
}

export const useUi = create<UiStore>()((set) => ({
  editingItem: null,
  sheet: null,
  editItem: (editingItem) => set({ editingItem }),
  openSheet: (sheet) => set({ sheet }),
}));
