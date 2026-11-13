import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/auth'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export interface OrgContext {
  supabase: ServerClient
  userId: string
  orgId: string
  role: UserRole
}

// Resolves the signed-in user and their organisation once per server action.
// getClaims() verifies the JWT locally when the project uses asymmetric signing
// keys (and falls back to an Auth server call otherwise), so it is never slower
// than getUser() and usually saves a network round trip.
export async function getOrgContext(): Promise<OrgContext | null> {
  const supabase = await createClient()

  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return null

  const { data: profile } = await supabase
    .from('profiles')
    // `*` so this keeps working before the member-access migration adds is_active
    .select('*')
    .eq('id', userId)
    .single()

  if (!profile?.org_id) return null
  // Removed from the organisation: treated the same as not signed in
  if (profile.is_active === false) return null

  return { supabase, userId, orgId: profile.org_id, role: profile.role as UserRole }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

// Most recent parent tasks to match through subtasks. Keeps the id list short
// enough to fit in a request URL.
const MAX_SUBTASK_PARENTS = 150

// PostgREST `or` filter matching tasks an employee works on: either the task is
// assigned to them directly, or one of its subtasks is. Tasks split into
// subtasks have no assignee of their own, so matching on tasks.assigned_to
// alone misses them.
export async function assigneeOrFilter(
  supabase: ServerClient,
  orgId: string,
  employeeId: string,
  subtaskStatus?: string
): Promise<string | null> {
  if (!isUuid(employeeId)) return null

  let query = supabase
    .from('subtasks')
    .select('task_id')
    .eq('assigned_to', employeeId)
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })

  if (subtaskStatus) query = query.eq('status', subtaskStatus)

  const { data } = await query

  const parentIds = [...new Set((data ?? []).map((s) => s.task_id as string))]
    .filter(isUuid)
    .slice(0, MAX_SUBTASK_PARENTS)

  return parentIds.length > 0
    ? `assigned_to.eq.${employeeId},id.in.(${parentIds.join(',')})`
    : `assigned_to.eq.${employeeId}`
}
