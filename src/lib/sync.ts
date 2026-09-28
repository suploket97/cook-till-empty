"use client";

/**
 * Network side of sync: the local store is the working copy (offline-first); these helpers pull the
 * household's rows, push the outbox, and listen for changes other household members make.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { itemFromRow, listFromRow, logFromRow, type IdMap, type Op, type Table } from "./sync-rows";
import type { KitchenData } from "./types";

let idMap: IdMap | null = null;
export const getIdMap = () => idMap;

export async function loadIdMap(sb: SupabaseClient): Promise<IdMap> {
  if (idMap) return idMap;
  const { data, error } = await sb.from("ingredients").select("id, slug");
  if (error) throw error;
  const map: IdMap = { toUuid: {}, toSlug: {} };
  for (const r of data ?? []) {
    map.toUuid[r.slug] = r.id;
    map.toSlug[r.id] = r.slug;
  }
  idMap = map;
  return map;
}

export interface Household {
  id: string;
  name: string;
  join_code: string;
}

export async function ensureHousehold(sb: SupabaseClient): Promise<Household> {
  const { data, error } = await sb.rpc("ensure_household");
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as Household;
}

export async function joinHousehold(sb: SupabaseClient, code: string): Promise<Household> {
  const { data, error } = await sb.rpc("join_household", { code });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as Household;
}

export async function pullKitchen(sb: SupabaseClient, householdId: string): Promise<KitchenData> {
  const ids = await loadIdMap(sb);
  const [inv, batches, list, log] = await Promise.all([
    sb.from("kitchen_inventory").select("*").eq("household_id", householdId),
    sb.from("inventory_batches").select("*").eq("household_id", householdId).gt("quantity", 0),
    sb.from("shopping_list").select("*").eq("household_id", householdId).eq("is_bought", false).order("created_at"),
    sb.from("cook_log").select("*").eq("household_id", householdId).order("cooked_at"),
  ]);
  for (const r of [inv, batches, list, log]) if (r.error) throw r.error;
  const byItem = new Map<string, any[]>();
  for (const b of batches.data ?? []) byItem.set(b.inventory_id, [...(byItem.get(b.inventory_id) ?? []), b]);
  return {
    items: (inv.data ?? []).map((r) => itemFromRow(r, ids, byItem.get(r.id) ?? [])),
    list: (list.data ?? []).map((r) => listFromRow(r, ids)),
    log: (log.data ?? []).map(logFromRow),
  };
}

/** Send pending operations. Returns the ones that could not be sent (to retry later). */
export async function pushOps(sb: SupabaseClient, ops: Op[]): Promise<Op[]> {
  const failed: Op[] = [];
  const tables: Table[] = ["kitchen_inventory", "inventory_batches", "shopping_list", "cook_log"];
  for (const table of tables) {
    const mine = ops.filter((o) => o.table === table);
    const ups = mine.filter((o) => o.kind === "upsert");
    const dels = mine.filter((o) => o.kind === "delete");
    const bought = mine.filter((o) => o.kind === "bought");
    if (ups.length) {
      const { error } = await sb.from(table).upsert(ups.map((o) => o.row!));
      if (error) failed.push(...ups);
    }
    if (dels.length) {
      const { error } = await sb.from(table).delete().in("id", dels.map((o) => o.id));
      if (error) failed.push(...dels);
    }
    if (bought.length) {
      const { error } = await sb.from(table).update({ is_bought: true }).in("id", bought.map((o) => o.id));
      if (error) failed.push(...bought);
    }
  }
  return failed;
}

/** Call `onChange` whenever someone in the household changes the fridge, list or log. */
export function subscribeKitchen(sb: SupabaseClient, householdId: string, onChange: () => void): () => void {
  const filter = `household_id=eq.${householdId}`;
  const channel = sb
    .channel(`kitchen-${householdId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "kitchen_inventory", filter }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "inventory_batches", filter }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "shopping_list", filter }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "cook_log", filter }, onChange)
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}
