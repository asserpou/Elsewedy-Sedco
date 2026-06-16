-- Elsewedy SEDCO CMS + Admin RLS patch
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.cms_pages (
  page_key text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.cms_pages enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.current_user_role()
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  user_role text;
begin
  select role into user_role
  from public.user_roles
  where user_id = auth.uid()
  limit 1;
  return user_role;
end;
$$;

create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return public.current_user_role() = 'admin';
end;
$$;

do $$
declare
  pol record;
begin
  for pol in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('user_roles', 'cms_pages')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

create policy "Users can read their own role"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "Admins can manage user roles"
on public.user_roles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Public can read CMS pages"
on public.cms_pages
for select
to anon, authenticated
using (true);

create policy "Admins can insert CMS pages"
on public.cms_pages
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update CMS pages"
on public.cms_pages
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete CMS pages"
on public.cms_pages
for delete
to authenticated
using (public.is_admin());

create or replace function public.assign_role_by_email(user_email text, assigned_role text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can assign roles';
  end if;

  if assigned_role not in ('admin', 'store_manager', 'order_manager', 'message_manager') then
    raise exception 'Invalid role: %', assigned_role;
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = lower(user_email)
  limit 1;

  if target_user_id is null then
    raise exception 'No auth user found for email: %', user_email;
  end if;

  insert into public.user_roles (user_id, role)
  values (target_user_id, assigned_role)
  on conflict (user_id) do update
  set role = excluded.role;
end;
$$;

delete from public.user_roles
where id not in (
  select distinct on (user_id) id
  from public.user_roles
  order by user_id, created_at desc, id desc
);

create unique index if not exists user_roles_user_id_unique
on public.user_roles(user_id);

grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.assign_role_by_email(text, text) to authenticated;

-- Table permissions
grant select on public.cms_pages to anon, authenticated;
grant insert, update, delete on public.cms_pages to authenticated;

grant select on public.user_roles to anon, authenticated;
grant insert, update, delete on public.user_roles to authenticated;

-- Ensure this account is marked as admin if the Auth user already exists.
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = 'adminsedco@gmail.com'
on conflict (user_id) do update
set role = 'admin';
