-- Apply in a newly created Supabase project, SQL Editor.
-- Private user-owned trips. Never expose service_role to the browser.
create table if not exists public.trips (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 1 and 90),
 region text not null default '' check (char_length(region) <= 80),
 days jsonb not null check (jsonb_typeof(days)='array' and jsonb_array_length(days) between 1 and 10 and octet_length(days::text) <= 100000),
 import_fingerprint text check(import_fingerprint is null or import_fingerprint ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists trips_owner_recent_idx on public.trips (owner_id, updated_at desc);
create unique index if not exists trips_unique_import_idx on public.trips (owner_id, import_fingerprint) where import_fingerprint is not null;
create or replace function public.touch_trip_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
 new.updated_at=now();
 return new;
end;
$$;
drop trigger if exists trips_touch_updated_at on public.trips;
create trigger trips_touch_updated_at before update on public.trips
for each row execute function public.touch_trip_updated_at();

alter table public.trips enable row level security;
alter table public.trips force row level security;
revoke all on public.trips from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, delete on public.trips to authenticated;
grant update (name,region,days,import_fingerprint) on public.trips to authenticated;

drop policy if exists trips_read_own on public.trips;
create policy trips_read_own on public.trips for select to authenticated
using ((select auth.uid()) is not null and owner_id=(select auth.uid()));
drop policy if exists trips_create_own on public.trips;
create policy trips_create_own on public.trips for insert to authenticated
with check ((select auth.uid()) is not null and owner_id=(select auth.uid()));
drop policy if exists trips_update_own on public.trips;
create policy trips_update_own on public.trips for update to authenticated
using ((select auth.uid()) is not null and owner_id=(select auth.uid()))
with check ((select auth.uid()) is not null and owner_id=(select auth.uid()));
drop policy if exists trips_delete_own on public.trips;
create policy trips_delete_own on public.trips for delete to authenticated
using ((select auth.uid()) is not null and owner_id=(select auth.uid()));

-- Test as two distinct authenticated Supabase sessions before production release.
-- Anonymous role has no grants and no RLS policy; the user's JWT determines auth.uid().

