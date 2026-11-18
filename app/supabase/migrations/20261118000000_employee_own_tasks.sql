-- Employees can add tasks, but only for themselves.
--
-- Admins and client servicing keep whatever insert rights they already have
-- (they assign work to anyone). This adds ONE extra, narrow permission: an
-- active member may insert a task in their own organisation as long as the
-- task is assigned to them and recorded as created by them. It cannot be used
-- to give a task to somebody else.
--
-- Run once in the Supabase SQL editor. Safe to run more than once.
-- Requires 20261113000000_member_access.sql (for is_active_member()).

drop policy if exists employees_add_own_tasks on public.tasks;

create policy employees_add_own_tasks on public.tasks
  for insert
  to authenticated
  with check (
    assigned_to = auth.uid()
    and created_by = auth.uid()
    and public.is_active_member()
    and org_id = (select p.org_id from public.profiles p where p.id = auth.uid())
  );
