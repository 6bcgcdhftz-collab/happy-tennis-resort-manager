-- Happy Tennis Resort Manager
-- Initial schema: authenticated users, resort tenancy, memberships and owner bootstrap.
create extension if not exists pgcrypto;

create type public.membership_role as enum (
  'maestro_responsabile',
  'maestri_collaboratori',
  'reception_sportiva',
  'direttore_sportivo',
  'amministrazione_resort',
  'manutenzione'
);

create table public.resorts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  timezone text not null default 'Europe/Rome',
  default_language text not null default 'it' check (default_language in ('it','en','es','fr')),
  currency text not null default 'EUR',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resort_memberships (
  id uuid primary key default gen_random_uuid(),
  resort_id uuid not null references public.resorts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(resort_id, user_id)
);

create table public.resort_owners (
  resort_id uuid not null references public.resorts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ownership_type text not null check (ownership_type in ('property','maestro_responsabile')),
  created_at timestamptz not null default now(),
  primary key (resort_id, user_id, ownership_type)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  resort_id uuid not null unique references public.resorts(id) on delete cascade,
  plan_type text not null default 'flat_monthly' check (plan_type = 'flat_monthly'),
  status text not null default 'pending' check (status in ('pending','active','past_due','suspended','cancelled')),
  billing_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create index resort_memberships_user_idx on public.resort_memberships(user_id);
create index resort_memberships_resort_idx on public.resort_memberships(resort_id);

-- Create profile after Supabase Auth creates a user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Atomic bootstrap: the authenticated creator becomes the first Maestro responsabile.
create or replace function public.create_resort_with_owner(p_resort_name text, p_owner_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_resort_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if exists (select 1 from public.resort_memberships where user_id = v_user_id and is_active = true) then
    raise exception 'This account already belongs to a resort';
  end if;

  insert into public.resorts(name) values (trim(p_resort_name)) returning id into v_resort_id;
  insert into public.resort_memberships(resort_id,user_id,role)
    values (v_resort_id,v_user_id,'maestro_responsabile');
  insert into public.resort_owners(resort_id,user_id,ownership_type)
    values (v_resort_id,v_user_id,'maestro_responsabile');
  insert into public.subscriptions(resort_id,status)
    values (v_resort_id,'pending');
  update public.profiles set full_name = trim(p_owner_name), updated_at = now()
    where id = v_user_id;
  return v_resort_id;
end;
$$;

revoke all on function public.create_resort_with_owner(text,text) from public;
grant execute on function public.create_resort_with_owner(text,text) to authenticated;

-- Helper functions used by row-level security policies.
create or replace function public.is_resort_member(p_resort_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.resort_memberships m
    where m.resort_id = p_resort_id and m.user_id = auth.uid() and m.is_active = true
  );
$$;

create or replace function public.is_resort_admin(p_resort_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.resort_memberships m
    where m.resort_id = p_resort_id and m.user_id = auth.uid()
      and m.role = 'maestro_responsabile' and m.is_active = true
  );
$$;

alter table public.resorts enable row level security;
alter table public.profiles enable row level security;
alter table public.resort_memberships enable row level security;
alter table public.resort_owners enable row level security;
alter table public.subscriptions enable row level security;

create policy "Members can view their resort"
on public.resorts for select to authenticated
using (public.is_resort_member(id));

create policy "Maestro responsabile can update resort"
on public.resorts for update to authenticated
using (public.is_resort_admin(id))
with check (public.is_resort_admin(id));

create policy "Users can view own profile"
on public.profiles for select to authenticated
using (id = auth.uid());

create policy "Users can update own profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Members can view memberships in own resort"
on public.resort_memberships for select to authenticated
using (public.is_resort_member(resort_id));

create policy "Maestro responsabile can manage memberships"
on public.resort_memberships for all to authenticated
using (public.is_resort_admin(resort_id))
with check (public.is_resort_admin(resort_id));

create policy "Owners can view ownership records"
on public.resort_owners for select to authenticated
using (public.is_resort_member(resort_id));

create policy "Members can view subscription status"
on public.subscriptions for select to authenticated
using (public.is_resort_member(resort_id));

-- Do not allow client-side direct writes to subscriptions.
revoke insert, update, delete on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.resorts to authenticated;
grant update on public.resorts to authenticated;
grant select, insert, update, delete on public.resort_memberships to authenticated;
grant select on public.resort_owners to authenticated;
