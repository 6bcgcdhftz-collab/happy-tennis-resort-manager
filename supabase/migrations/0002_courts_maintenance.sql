
-- Happy Tennis Resort Manager
-- Modulo 1: Manutenzione campi

create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  resort_id uuid not null references public.resorts(id) on delete cascade,
  name text not null,
  sport text not null check (sport in ('tennis', 'padel', 'pickleball')),
  surface text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (resort_id, name)
);

create table if not exists public.court_maintenance (
  id uuid primary key default gen_random_uuid(),
  resort_id uuid not null references public.resorts(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'da_programmare'
    check (status in ('da_programmare', 'programmato', 'in_corso', 'completato', 'annullato')),
  priority text not null default 'normale'
    check (priority in ('bassa', 'normale', 'alta', 'urgente')),
  scheduled_date date,
  completed_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courts_resort_idx
  on public.courts(resort_id);

create index if not exists court_maintenance_resort_idx
  on public.court_maintenance(resort_id);

create index if not exists court_maintenance_court_idx
  on public.court_maintenance(court_id);

create index if not exists court_maintenance_date_idx
  on public.court_maintenance(scheduled_date);

alter table public.courts enable row level security;
alter table public.court_maintenance enable row level security;

grant select, insert, update, delete
  on public.courts, public.court_maintenance
  to authenticated;

create policy "Resort members can view courts"
on public.courts
for select to authenticated
using (public.is_resort_member(resort_id));

create policy "Resort admin can manage courts"
on public.courts
for all to authenticated
using (public.is_resort_admin(resort_id))
with check (public.is_resort_admin(resort_id));

create policy "Resort members can view maintenance"
on public.court_maintenance
for select to authenticated
using (public.is_resort_member(resort_id));

create policy "Resort admin can manage maintenance"
on public.court_maintenance
for all to authenticated
using (public.is_resort_admin(resort_id))
with check (public.is_resort_admin(resort_id));

create or replace function public.update_court_maintenance_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();

  if new.status = 'completato' and old.status is distinct from 'completato' then
    new.completed_at = now();
  elsif new.status <> 'completato' then
    new.completed_at = null;
  end if;

  return new;
end;
$$;

create trigger court_maintenance_updated_at
before update on public.court_maintenance
for each row
execute function public.update_court_maintenance_timestamp();
