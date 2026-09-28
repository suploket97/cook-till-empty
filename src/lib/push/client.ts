"use client";

import { getSupabase } from "@/lib/supabase/client";
import type { Lang } from "@/lib/types";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export type PushState = "unsupported" | "ios-install" | "denied" | "off" | "on";

export const notificationsSupported = () =>
  typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;

const isIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** Daily push (app closed) needs VAPID keys, Supabase sign-in and a browser with Push. */
export const pushAvailable = () => Boolean(VAPID_PUBLIC) && typeof window !== "undefined" && "PushManager" in window;

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export async function pushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return "ios-install";
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (!pushAvailable()) return Notification.permission === "granted" ? "on" : "off";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

function keyBytes(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Ask permission; with push available (and signed in), subscribe this device for the daily summary. */
export async function enableNotifications(opts: { lang: Lang; alertDays: number; signedIn: boolean }): Promise<"push" | "local"> {
  if (process.env.NODE_ENV !== "production") throw new Error("dev");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("denied");
  const reg = await registration();
  const sb = getSupabase();
  if (!pushAvailable() || !opts.signedIn || !sb) return "local";
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) as BufferSource }));
  await saveSubscription(sub, opts.lang, opts.alertDays);
  return "push";
}

export async function saveSubscription(sub: PushSubscription, lang: Lang, alertDays: number) {
  const sb = getSupabase();
  if (!sb) return;
  const json = sub.toJSON();
  const { error } = await sb.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
    p_lang: lang,
    p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    p_alert_days: alertDays,
  });
  if (error) throw error;
}

/** Keep the server copy of language / warning days in step with the app settings. */
export async function syncPushPrefs(lang: Lang, alertDays: number) {
  if (!pushAvailable() || !notificationsSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await saveSubscription(sub, lang, alertDays).catch(() => {});
}

export async function disableNotifications() {
  if (!notificationsSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const sb = getSupabase();
  await sb?.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export async function sendTestPush(lang: Lang): Promise<boolean> {
  const res = await fetch("/api/push/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang }) });
  if (!res.ok) return false;
  const body = (await res.json()) as { sent?: number };
  return (body.sent ?? 0) > 0;
}

/** Show a notification from the page (used when the app opens and daily push isn't set up). */
export async function showLocal(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (reg) await reg.showNotification(title, { body, tag: "expiry-digest", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: "/#expiring" } });
    else new Notification(title, { body, icon: "/icons/icon-192.png", tag: "expiry-digest" });
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}
