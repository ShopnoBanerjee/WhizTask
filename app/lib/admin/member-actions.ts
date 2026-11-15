'use server'

import { revalidatePath } from 'next/cache'
import { getOrgContext, isUuid } from '@/lib/auth/context'
import type { UserRole } from '@/types/auth'
import type { Department, OrgMember } from '@/types/database'

// Admins and client servicing manage members. Client servicing cannot change
// an admin's access (the database function enforces that as well).
const MANAGER_ROLES: UserRole[] = ['admin', 'client_servicing']
const NOT_ALLOWED = 'Only admins and client servicing can manage members'

// Members of the signed-in user's organisation, including removed ones.
export async function getOrgMembers(): Promise<{
  members: OrgMember[]
  currentUserId: string | null
  currentUserRole: UserRole | null
  error?: string
}> {
  const ctx = await getOrgContext()
  if (!ctx) return { members: [], currentUserId: null, currentUserRole: null, error: 'Not authenticated' }
  if (!MANAGER_ROLES.includes(ctx.role)) {
    return { members: [], currentUserId: ctx.userId, currentUserRole: ctx.role, error: NOT_ALLOWED }
  }

  // `*` rather than naming is_active, so this still works (everyone shown as
  // active) if the member-access migration has not been run yet
  const { data, error } = await ctx.supabase
    .from('profiles')
    .select('*, employee_departments(department)')
    .eq('org_id', ctx.orgId)
    .order('name')

  if (error) {
    console.error('Error fetching members:', error)
    return { members: [], currentUserId: ctx.userId, currentUserRole: ctx.role, error: error.message }
  }

  const members: OrgMember[] = (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    departments: (p.employee_departments || []).map((d: any) => d.department as Department),
    isActive: p.is_active !== false,
    removedAt: p.removed_at ?? null,
    joinedAt: p.created_at,
  }))

  return { members, currentUserId: ctx.userId, currentUserRole: ctx.role }
}

// Removes or restores a member's access. Nothing is deleted: the profile and
// all of the person's tasks, subtasks and time logs are kept.
export async function setMemberAccess(memberId: string, active: boolean) {
  const ctx = await getOrgContext()
  if (!ctx) return { error: 'Not authenticated' }
  if (!MANAGER_ROLES.includes(ctx.role)) return { error: NOT_ALLOWED }
  if (!isUuid(memberId)) return { error: 'Invalid member' }
  if (memberId === ctx.userId) return { error: 'You cannot change your own access' }

  // The database function repeats these checks (allowed role, same
  // organisation, not yourself, only an admin may change an admin) so they
  // hold even for requests that bypass this app
  const { error } = await ctx.supabase.rpc('set_member_access', {
    member_id: memberId,
    active,
  })

  if (error) {
    console.error('Error changing member access:', error)
    // PGRST202: function not found, i.e. the migration has not been run
    if (error.code === 'PGRST202') {
      return { error: 'Member access is not set up yet. Run supabase/migrations/20261113000000_member_access.sql in the Supabase SQL editor.' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/members')
  revalidatePath('/admin/tasks')
  return { success: true }
}
