create table if not exists public.go_joseki_stores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_go_joseki_stores_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_go_joseki_stores_updated_at on public.go_joseki_stores;

create trigger set_go_joseki_stores_updated_at
before update on public.go_joseki_stores
for each row
execute function public.set_go_joseki_stores_updated_at();

alter table public.go_joseki_stores enable row level security;

drop policy if exists "go_joseki_stores_select_own" on public.go_joseki_stores;
drop policy if exists "go_joseki_stores_insert_own" on public.go_joseki_stores;
drop policy if exists "go_joseki_stores_update_own" on public.go_joseki_stores;
drop policy if exists "go_joseki_stores_delete_own" on public.go_joseki_stores;

create policy "go_joseki_stores_select_own"
on public.go_joseki_stores
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "go_joseki_stores_insert_own"
on public.go_joseki_stores
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "go_joseki_stores_update_own"
on public.go_joseki_stores
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "go_joseki_stores_delete_own"
on public.go_joseki_stores
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.go_joseki_stores to authenticated;
