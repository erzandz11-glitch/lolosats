-- LolosATS initial schema. Run in Supabase SQL Editor or via Supabase CLI.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'CV Baru' check (char_length(title) between 1 and 120),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists resumes_user_updated_idx on public.resumes(user_id, updated_at desc);

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  code_hash text not null unique,
  status text not null default 'unused' check (status in ('unused','active','revoked','expired')),
  expires_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.license_events (
  id uuid primary key default gen_random_uuid(),
  license_id uuid references public.licenses(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name','')) on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.licenses enable row level security;
alter table public.license_events enable row level security;

drop policy if exists "profile read own" on public.profiles;
create policy "profile read own" on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
drop policy if exists "profile update own" on public.profiles;
create policy "profile update own" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid() and role='user');
drop policy if exists "resume own all" on public.resumes;
create policy "resume own all" on public.resumes for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "license own read" on public.licenses;
create policy "license own read" on public.licenses for select to authenticated using (user_id=auth.uid() or public.is_admin());
drop policy if exists "license admin all" on public.licenses;
create policy "license admin all" on public.licenses for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "license events admin read" on public.license_events;
create policy "license events admin read" on public.license_events for select to authenticated using (public.is_admin());

revoke all on public.licenses from anon, authenticated;
grant select on public.licenses to authenticated;
grant all on public.licenses to service_role;
revoke all on public.license_events from anon, authenticated;
grant select on public.license_events to authenticated;
grant all on public.license_events to service_role;
grant select, insert, update, delete on public.resumes to authenticated;
grant select, update on public.profiles to authenticated;
