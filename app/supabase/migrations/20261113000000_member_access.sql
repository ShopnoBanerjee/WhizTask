-- Member access: lets an admin remove someone from the organisation without
-- deleting anything. The person's profile, tasks, subtasks and time logs stay
-- exactly as they are; they just can no longer use the app, and an admin can
-- restore them later.
--
-- Run this once in the Supabase SQL editor BEFORE deploying the app change.
-- It is safe to run more than once.

-- 1. The flag ---------------------------------------------------------------

alter table public.profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references public.profiles (id);

-- 2. Is the signed-in user still an active member? ---------------------------

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_active from profiles p where p.id = auth.uid()), false)
$$;

revoke all on function public.is_active_member() from public;
grant execute on function public.is_active_member() to authenticated;

-- 3. The only way to change someone's access ---------------------------------
-- Checks that the caller is an active admin or client-servicing member of the
-- same organisation and is not changing their own access. Only an admin can
-- change another admin's access, so an org can never lose its last admin.

create or replace function public.set_member_access(member_id uuid, active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller profiles%rowtype;
  target profiles%rowtype;
begin
  select * into caller from profiles where id = auth.uid();

  if caller.id is null
     or caller.role::text not in ('admin', 'client_servicing')
     or caller.is_active is not true
     or caller.org_id is null then
    raise exception 'Only admins and client servicing can change member access';
  end if;

  if member_id = caller.id then
    raise exception 'You cannot change your own access';
  end if;

  select * into target from profiles where id = member_id and org_id = caller.org_id;

  if target.id is null then
    raise exception 'Member not found in your organization';
  end if;

  if target.role::text = 'admin' and caller.role::text <> 'admin' then
    raise exception 'Only an admin can change another admin''s access';
  end if;

  -- tells the trigger below that this change is legitimate
  perform set_config('app.member_access_change', 'on', true);

  update profiles
  set is_active  = active,
      removed_at = case when active then null else now() end,
      removed_by = case when active then null else caller.id end,
      updated_at = now()
  where id = member_id;
end;
$$;

revoke all on function public.set_member_access(uuid, boolean) from public;
grant execute on function public.set_member_access(uuid, boolean) to authenticated;

-- 4. Nobody can flip the flag on their own profile ---------------------------
-- Users can update their own profile row, so without this a removed person
-- could simply set is_active back to true. Changes made from the SQL editor or
-- with the service role (no signed-in user) are still allowed.

create or replace function public.protect_member_access()
returns trigger
language plpgsql
as $$
begin
  if (new.is_active is distinct from old.is_active
      or new.removed_at is distinct from old.removed_at
      or new.removed_by is distinct from old.removed_by)
     and auth.uid() is not null
     and coalesce(current_setting('app.member_access_change', true), '') <> 'on' then
    raise exception 'Member access can only be changed from the Members page';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_member_access on public.profiles;
create trigger protect_member_access
  before update on public.profiles
  for each row execute function public.protect_member_access();

-- 5. Enforce it in the database, not only in the app -------------------------
-- A removed person still holds a valid login, so the app hiding its pages is
-- not enough on its own. These RESTRICTIVE policies are combined (AND) with
-- whatever policies already exist: they can only take access away, never grant
-- it. `profiles` is left out on purpose so a removed person can still read
-- their own row and be shown the "access removed" page.

do $$
declare
  t text;
begin
  foreach t in array array[
    'tasks', 'subtasks', 'clients', 'time_logs', 'employee_departments',
    'software', 'software_subscriptions', 'overheads', 'audit_logs'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists active_members_only on public.%I', t);
      execute format(
        'create policy active_members_only on public.%I as restrictive for all to authenticated '
        || 'using (public.is_active_member()) with check (public.is_active_member())',
        t
      );
    end if;
  end loop;
end;
$$;
