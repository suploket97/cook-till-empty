-- Cook-Till-Empty · purchase dates, use-by / best-before, and expiry notifications.
-- Run after 0001_init.sql (SQL Editor → paste → Run). Safe to run more than once.

-- ───────────────────────── typical shelf life on the catalogue ─────────────────────────
alter table public.ingredients add column if not exists shelf_days integer;
alter table public.ingredients add column if not exists shelf_kind text check (shelf_kind in ('use_by', 'best_before'));

-- ───────────────────────── purchases ("batches") ─────────────────────────
-- Each purchase of an inventory item, with its own amount and dates. kitchen_inventory.quantity is their total.
create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  inventory_id uuid not null references public.kitchen_inventory (id) on delete cascade,
  quantity numeric not null check (quantity >= 0),
  purchased_on date not null default current_date,
  use_by date,        -- safety date: don't eat after
  best_before date,   -- quality date: check after
  estimated boolean not null default false,  -- dates estimated from typical shelf life
  created_at timestamptz not null default now()
);
create index if not exists inventory_batches_item_idx on public.inventory_batches (inventory_id);
create index if not exists inventory_batches_expiry_idx on public.inventory_batches (household_id, use_by, best_before) where quantity > 0;

alter table public.inventory_batches enable row level security;
drop policy if exists "household batches" on public.inventory_batches;
create policy "household batches" on public.inventory_batches
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ───────────────────────── push subscriptions (one per device) ─────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  lang text not null default 'en' check (lang in ('en', 'th')),
  time_zone text not null default 'Europe/London',
  alert_days integer not null default 2 check (alert_days between 0 and 7),
  last_sent_on date,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ───────────────────────── realtime ─────────────────────────
do $$
begin
  begin alter publication supabase_realtime add table public.inventory_batches; exception when duplicate_object then null; end;
end $$;

-- Save (or move to the caller) this device's push subscription. A device that changes account keeps one row.
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_lang text, p_time_zone text, p_alert_days integer
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, lang, time_zone, alert_days)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_lang, p_time_zone, p_alert_days)
  on conflict (endpoint) do update set
    user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
    lang = excluded.lang, time_zone = excluded.time_zone, alert_days = excluded.alert_days;
end $$;

revoke all on function public.save_push_subscription(text, text, text, text, text, integer) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text, text, integer) to authenticated;
