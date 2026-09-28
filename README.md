# Cook-Till-Empty · ทำจนหมด

A bilingual (Thai / English) zero-waste kitchen app. Your **fridge** and your **shopping list** feed each other, and the app suggests three meals from what you already have:

- **A · Zero-Purchase**: only what's in stock, plus pantry staples.
- **B · Smart Substitution**: a swap that keeps the dish working, e.g. Thai sweet basil for holy basil in a UK kitchen.
- **C · Plus-One Buy**: one cheap item unlocks a better meal, and one tap puts it on your list.

It also tracks **when you bought things and their use-by / best-before dates**, uses the soonest-expiring food first, and sends **expiry alerts**.

Everything works without an account or an AI key. Supabase adds sign-in, sync across devices and a shared household kitchen. An AI key adds fresh recipe ideas on top of the built-in matcher.

## Stack

| Part | What |
|---|---|
| App | Next.js 15 (App Router), React 19, TypeScript |
| UI | Tailwind CSS v4, Motion (Framer Motion), Lucide icons |
| State | Zustand, persisted on the device (offline-first) |
| Data | Supabase Postgres + Auth (email magic link) + Realtime |
| AI | Vercel AI SDK v5: OpenAI, Google Gemini or Anthropic Claude (choose with one env var) |
| Install | Web app manifest + service worker (add to home screen, opens offline) |

## Run it locally

```bash
npm install
cp .env.example .env.local   # optional: leave empty to run fully on-device
npm run dev                  # http://localhost:3000
npm test                     # parser, units, matcher, kitchen loop, sync rows
```

Needs Node 20 or newer.

## Set up Supabase (sync, sign-in, households)

1. Create a project at [supabase.com](https://supabase.com). The free tier is enough.
2. **SQL Editor**: run these three files in order (paste each one, then Run):
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/migrations/0002_expiry_and_alerts.sql`
   3. `supabase/seed.sql` (loads the 129-ingredient catalogue with typical shelf life)
3. **Project Settings → API**: copy the Project URL and the `anon` public key into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Authentication → URL Configuration**:
   - Site URL: your app's URL (e.g. `https://cook-till-empty.vercel.app`, or `http://localhost:3000` while developing).
   - Redirect URLs: add `https://YOUR-DOMAIN/auth/callback` and `http://localhost:3000/auth/callback`.
5. Optional: **Authentication → Emails**. Supabase's built-in email sender is rate-limited and meant for testing. For real users, add your own SMTP (e.g. Resend or Postmark).

**How sharing works.** On first sign-in each person gets a household with a 6-character join code (Account button, top right). Someone else signs in, enters that code under "Join another household", and from then on both see the same fridge, list and cooking log, updated live.

**First sync.** If the household is empty, the device's current kitchen is uploaded. If the household already has data, the shared kitchen replaces what's on the device.

## Recipe ideas without AI

With AI switched off, ideas come from a built-in library of **200 dishes**, written for this app in Thai and English (no copied recipe text):

| Cuisine | Dishes |
|---|---|
| Thai (incl. 11 Thai desserts) | 64 |
| British (incl. puddings) | 26 |
| Italian, French, Spanish | 31 |
| Greek & Middle Eastern | 11 |
| Indian | 12 |
| Chinese, Japanese, Korean | 26 |
| Southeast Asian | 9 |
| Mexican, American | 21 |

27 are desserts; 58 in all are desserts, breakfasts or snacks.

Each recipe lists required ingredient groups (any one of `pork_mince|chicken` will do), optional extras, and swaps it can make (Thai sweet basil for holy basil). The matcher checks every dish against your fridge and:

- picks **A** (cook now), **B** (cook now with a swap) and **C** (buy one thing), preferring food that is expiring or running low
- lists **more dishes you can make now**, and dishes **one or two items away**, with one tap to add the missing items to the list
- filters by course (**Meals / Breakfast & snacks / Desserts / Everything**) and by cuisine, and has a **Surprise me** button

When AI is on, the same filters are passed to the AI, so "Italian desserts" asks for Italian desserts.

## Dates and expiry

Every time you add stock, it's recorded as a separate **purchase** with its own amount, bought date, use-by and best-before. Tap an item's name to see and edit its purchases.

- **Entering dates.** Type them with the item: `milk 1L use by 3/10`, `ไก่ 500 กรัม หมดอายุ 29/9`, `cheese bb 12 oct bought yesterday`. Or open **Dates** under the add bar. Day-first dates, English and Thai month names, `today` / `tomorrow` / `พรุ่งนี้`, and Buddhist-era years (2569) all work.
- **If you don't enter dates,** typical ones are estimated from the item's shelf life in `src/lib/catalog.ts` (`SHELF_LIFE`) and shown with a `~`. The packet always wins, so edit them when you can.
- **Use by vs best before (UK meaning).** Use by is about safety: after it, the app says don't eat, offers **Throw away**, and never uses that stock in recipes (built-in or AI). Best before is about quality: after it, the app says check it first.
- **Soonest-expiring first.** Cooking and the − button take from the purchase that expires first. Recipe ideas rank dishes that use expiring food highest and mark those ingredients "use soon".
- **"Use these first"** at the top of the app lists everything within your warning window (Bell → Warn me: on the day, 1, 2, 3 or 5 days before).

## Expiry notifications

Bell → **Notifications on this device** → Turn on.

| Setup | What you get |
|---|---|
| Not signed in, or push keys not set | A reminder when you open the app (once a day) |
| Signed in + push keys + daily job | A short summary once a day, even when the app is closed, in your language, e.g. "1 past use-by · 2 to use soon: Chicken (use-by passed 1 day ago), Spinach (best before tomorrow)…" |

To set up the daily push:

1. `npm run vapid` prints a key pair. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT=mailto:you@example.com`.
2. Set `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API → `service_role`). This is server-only: never prefix it with `NEXT_PUBLIC_`.
3. Set `CRON_SECRET` to a long random string.
4. Deploy to Vercel. `vercel.json` schedules `/api/cron/expiry` daily at **06:00 UTC**: 7am UK in summer, 6am in winter, 1pm in Thailand. Change the `schedule` if you prefer. The Hobby plan allows one run a day.
5. In the app: sign in, Bell → Turn on → **Send a test**.

Things to know:

- **iPhone / iPad:** web notifications only work after the app is added to the Home Screen (Share → Add to Home Screen) and opened from there (iOS 16.4+). The app tells people this.
- **Local testing:** notifications need the production build (`npm run build && npm start`), because the service worker is off in `npm run dev`.
- **Manual trigger:** `curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/cron/expiry`. Each device gets at most one summary per local day, and a device that has unsubscribed is removed automatically.

## Turn on AI recipe ideas (optional)

Set **one** provider key on the server. They are never exposed to the browser.

| Provider | Env vars | Default model |
|---|---|---|
| OpenAI | `AI_PROVIDER=openai`, `OPENAI_API_KEY` | `gpt-4.1-mini` |
| Google | `AI_PROVIDER=google`, `GOOGLE_GENERATIVE_AI_API_KEY` | `gemini-2.5-flash` |
| Anthropic | `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` | `claude-haiku-4-5-20251001` |

- Override the model with `AI_MODEL`. Model names change often, so check your provider's current list.
- With no key set, the "Ask AI" button is simply hidden and the built-in matcher does the work.
- With Supabase configured, only signed-in users can call the AI routes.
- Everyone gets a per-person limit (`AI_RATE_LIMIT`, default 12 requests per 10 minutes). The limit is kept in memory per server instance: enough to stop accidents, not a determined abuser. If you open the app to the public, move it to a shared store such as Upstash Redis and set a spending cap in your provider's dashboard.
- Cost: one recipe request is a few thousand tokens, typically well under 1p / ฿0.5 on the small models above.

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. [vercel.com/new](https://vercel.com/new) → import the repo. The framework is detected automatically.
3. **Settings → Environment Variables**: add the same keys as `.env.local`.
4. Deploy, then put the production URL into Supabase's Site URL and Redirect URLs (step 4 above).

**Install on a phone.** Open the site, then use Share → Add to Home Screen (iPhone) or Install app (Android / Chrome). The installed app opens offline. Changes made offline sync when the connection comes back.

## Legal and safety checklist

Using an AI API in your own app is normal and allowed. These are the things that make it responsible. This is not legal advice: have the privacy notice checked properly if the app is public or commercial.

- [x] AI key stays on the server (`src/lib/ai/provider.ts`, `import "server-only"`).
- [x] AI output is labelled on every AI recipe card, with an allergen and food-safety line. Some providers' policies require telling users they're seeing AI output.
- [x] Only fridge contents are sent to the AI provider, never email or account data (`src/lib/ai/map.ts → buildRequest`).
- [ ] Fill in and publish the privacy notice template at `/privacy` (`src/app/privacy/page.tsx`). It's written for UK GDPR; Thailand's PDPA is similar in spirit. It names the AI provider and Supabase as processors.
- [ ] Read your AI provider's usage policy and API terms, and set a monthly spend limit.
- [ ] If you add analytics or cookies beyond the sign-in session cookie, add consent.
- [x] Notifications only after the person turns them on (browser permission prompt), and they can turn them off in the same place. Signing out removes the device's subscription.
- [x] Expiry dates are marked as estimates unless entered. The "use by" wording follows UK Food Standards Agency meaning: don't eat after the date.

## Project map

```
src/
  app/
    page.tsx               the app (client component tree in components/)
    api/recipes            POST fridge summary → 3 AI recipes (zod-validated JSON)
    api/classify           POST unknown items → English/Thai name + category
    api/ai-status          GET whether an AI provider is configured
    api/cron/expiry        daily expiry summary push (Vercel Cron)
    api/push/test          send a test notification to your devices
    auth/callback          magic-link landing
    privacy/               privacy notice template
    manifest.ts            PWA manifest
  components/              Header, Intake, FridgePanel, ListPanel, CookPanel, RecipeCard, AccountSheet, SyncController…
  lib/
    catalog.ts             129 ingredients: TH/EN names, aliases, unit, pack size, portion, prices, shelf life
    parser.ts              free-text TH/EN parser with amounts ("หมูสับ 300 กรัม, 6 eggs, นม 1 ลิตร")
    units.ts               units, formatting (g→kg, ml→L, ฟอง/กลีบ/กำ…), status from amount
    recipes/               200 built-in recipes (Thai, British, European, Asian, Mexican, American, desserts) with TH/EN methods
    matcher.ts             picks the A/B/C ideas, preferring what's running low
    kitchen.ts             pure fridge/list/cook operations (undo = snapshot)
    dates.ts               TH/EN date parsing and formatting (day-first, Buddhist-era years)
    expiry.ts              purchases, soonest-first use, what's expiring, notification wording
    push/                  browser subscription (client) and web-push sender (server)
    sync-rows.ts           app data ⇄ database rows, and the diff that feeds the sync outbox
    sync.ts                pull / push / realtime with Supabase
    ai/                    prompt, schema, provider switch, request guard
  store/kitchen.ts         Zustand store (persisted), commits changes to the outbox
supabase/
  migrations/0001_init.sql tables, row-level security, household functions, realtime
  migrations/0002_…sql     purchases with dates, push subscriptions, shelf life
  seed.sql                 generated from lib/catalog.ts (npm run gen:seed)
public/sw.js               offline service worker + push notifications
vercel.json                daily cron for expiry alerts
```

## Data model

The schema follows the original spec, with these additions:

- **`households` + `household_members`**: one household per user, shared through a join code. Row-level security limits every row to the caller's household.
- **`ingredients`**: adds `slug`, `unit`, `pack_size`, `portion`, `price_thb`, `price_gbp` and `aliases`.
- **`kitchen_inventory`**: adds `household_id`, `quantity`, `unit`, `full_quantity` (the last restock, which "running low" is measured against) and English/Thai custom names. `status` is still stored, but it's derived from the amount.
- **`shopping_list`**: adds `household_id`, `quantity`, `unit`, `category` and `ingredient_name_th`. `aisle_category` is written for the kitchen region at the time the item was added. Bought items are kept with `is_bought = true`.
- **`cook_log`**: every "Cooked it", with the estimated waste saved in both currencies.
- **`inventory_batches`**: one row per purchase, with `quantity`, `purchased_on`, `use_by`, `best_before` and `estimated`. The inventory row's `quantity` is their total.
- **`push_subscriptions`**: one row per device that turned notifications on, with its language, time zone and warning window. It is saved through `save_push_subscription()`, so a device that changes account keeps a single row.
- **`ingredients.shelf_days` / `shelf_kind`**: typical shelf life, used for estimates.

## Known limits

- Conflicts are last-write-wins per row. That's fine for a household, but two people editing the same item in the same second will see the later edit win.
- Prices are rough averages for estimates only. Edit them in `lib/catalog.ts` and re-run `npm run gen:seed`.
- The built-in library has 200 dishes. Add your own in `src/lib/recipes/` with the `r()` helper; `npm test` checks every ingredient id exists and both languages are filled in.
