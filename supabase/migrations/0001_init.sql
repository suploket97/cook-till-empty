-- Cook-Till-Empty schema
-- Run in Supabase: SQL Editor → paste this file → Run. Then run supabase/seed.sql.
-- Every user belongs to one household; fridge, shopping list and cook log are shared within it.

-- ───────────────────────── households ─────────────────────────
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My kitchen',
  join_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index if not exists household_members_household_idx on public.household_members (household_id);

-- ───────────────────────── ingredients catalogue (bilingual alias mapping) ─────────────────────────
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_th text not null,
  name_en text not null,
  category text not null check (category in ('produce', 'meat', 'pantry', 'chilled')),
  unit text not null,
  pack_size numeric not null,
  portion numeric not null,
  price_thb numeric,
  price_gbp numeric,
  aliases text[] not null default '{}'
);

-- ───────────────────────── kitchen inventory ─────────────────────────
create table if not exists public.kitchen_inventory (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  ingredient_id uuid references public.ingredients (id),
  custom_name text,
  custom_name_en text,
  custom_name_th text,
  custom_category text check (custom_category in ('produce', 'meat', 'pantry', 'chilled')),
  quantity numeric not null default 0 check (quantity >= 0),
  unit text not null,
  full_quantity numeric not null default 0,
  status text check (status in ('IN_STOCK', 'RUNNING_LOW', 'OUT_OF_STOCK')),
  updated_at timestamptz not null default now(),
  constraint inventory_names_something check (ingredient_id is not null or custom_name is not null)
);
create index if not exists kitchen_inventory_household_idx on public.kitchen_inventory (household_id);

-- ───────────────────────── shopping list ─────────────────────────
create table if not exists public.shopping_list (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  ingredient_id uuid references public.ingredients (id),
  ingredient_name text not null,
  ingredient_name_th text,
  category text not null default 'pantry' check (category in ('produce', 'meat', 'pantry', 'chilled')),
  aisle_category text not null, -- 'fresh_market' | 'supermarket' (TH) · 'produce' | 'chilled' | 'pantry' (UK)
  quantity numeric not null default 1 check (quantity > 0),
  unit text not null,
  is_bought boolean not null default false,
  added_from_recipe text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shopping_list_household_idx on public.shopping_list (household_id) where not is_bought;

-- ───────────────────────── cook log ("waste saved") ─────────────────────────
create table if not exists public.cook_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  recipe_title text not null,
  saved_thb numeric not null default 0,
  saved_gbp numeric not null default 0,
  cooked_at timestamptz not null default now()
);
create index if not exists cook_log_household_idx on public.cook_log (household_id);

-- ───────────────────────── updated_at ─────────────────────────
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists kitchen_inventory_touch on public.kitchen_inventory;
create trigger kitchen_inventory_touch before update on public.kitchen_inventory
  for each row execute function public.touch_updated_at();
drop trigger if exists shopping_list_touch on public.shopping_list;
create trigger shopping_list_touch before update on public.shopping_list
  for each row execute function public.touch_updated_at();

-- ───────────────────────── household helpers ─────────────────────────
create or replace function public.current_household_id() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.household_members where user_id = auth.uid()
$$;

-- Returns the caller's household, creating one on first sign-in.
create or replace function public.ensure_household() returns public.households
language plpgsql security definer set search_path = public as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select hh.* into h from public.households hh
    join public.household_members m on m.household_id = hh.id
    where m.user_id = auth.uid();
  if found then
    return h;
  end if;
  insert into public.households default values returning * into h;
  insert into public.household_members (user_id, household_id) values (auth.uid(), h.id);
  return h;
end $$;

-- Move the caller into the household with this join code.
create or replace function public.join_household(code text) returns public.households
language plpgsql security definer set search_path = public as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select * into h from public.households where join_code = upper(trim(code));
  if not found then
    raise exception 'no household with that code';
  end if;
  insert into public.household_members (user_id, household_id) values (auth.uid(), h.id)
    on conflict (user_id) do update set household_id = excluded.household_id, joined_at = now();
  return h;
end $$;

revoke all on function public.ensure_household() from public, anon;
revoke all on function public.join_household(text) from public, anon;
grant execute on function public.ensure_household() to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.current_household_id() to authenticated;

-- ───────────────────────── row level security ─────────────────────────
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.ingredients enable row level security;
alter table public.kitchen_inventory enable row level security;
alter table public.shopping_list enable row level security;
alter table public.cook_log enable row level security;

drop policy if exists "read own household" on public.households;
create policy "read own household" on public.households
  for select to authenticated using (id = public.current_household_id());

drop policy if exists "read household members" on public.household_members;
create policy "read household members" on public.household_members
  for select to authenticated using (household_id = public.current_household_id());

drop policy if exists "catalogue is public" on public.ingredients;
create policy "catalogue is public" on public.ingredients
  for select to anon, authenticated using (true);

drop policy if exists "household inventory" on public.kitchen_inventory;
create policy "household inventory" on public.kitchen_inventory
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

drop policy if exists "household shopping list" on public.shopping_list;
create policy "household shopping list" on public.shopping_list
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

drop policy if exists "household cook log" on public.cook_log;
create policy "household cook log" on public.cook_log
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ───────────────────────── realtime (other household members see changes live) ─────────────────────────
do $$
begin
  begin alter publication supabase_realtime add table public.kitchen_inventory; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.shopping_list; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.cook_log; exception when duplicate_object then null; end;
end $$;
