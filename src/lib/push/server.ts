import "server-only";
import webpush from "web-push";

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const PRIVATE = process.env.VAPID_PRIVATE_KEY || "";

/** Push needs a VAPID key pair (npm run vapid). */
export const pushConfigured = () => Boolean(PUBLIC && PRIVATE);

let ready = false;
function setup() {
  if (ready) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", PUBLIC, PRIVATE);
  ready = true;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Send one notification. "gone" means the device unsubscribed: delete its row. */
export async function sendPush(target: PushTarget, payload: PushPayload): Promise<"ok" | "gone" | "error"> {
  setup();
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12, urgency: "normal" },
    );
    return "ok";
  } catch (err) {
    const code = (err as { statusCode?: number })?.statusCode;
    if (code === 404 || code === 410) return "gone";
    console.error("Push failed", code, err);
    return "error";
  }
}
