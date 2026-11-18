'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getOrgContext, assigneeOrFilter, type OrgContext } from '@/lib/auth/context'
import type { Client, Department, TaskStatus, TaskWithRelations, EmployeeWithDepartments, PaginatedTasks, TaskFilters, TaskFormOptions } from '@/types/database'

const TASK_WITH_SUBTASKS = `
  *,
  client:clients(*),
  assigned_employee:profiles!tasks_assigned_to_fkey(id, email, name),
  subtasks(
    *,
    assigned_employee:profiles!subtasks_assigned_to_fkey(id, email, name)
  )
`

// ---- internal queries: take an already-resolved context so one server action
// can run several of them in parallel without re-authenticating each time ----

async function fetchClients({ supabase, orgId }: OrgContext): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('org_id', orgId)
    .order('name')

  if (error) {
    console.error('Error fetching clients:', error)
    return []
  }
  return data || []
}

async function fetchOrgEmployees({ supabase, orgId }: OrgContext): Promise<EmployeeWithDepartments[]> {
  // client_servicing users are employees too and can be assigned work
  const { data, error } = await supabase
    .from('profiles')
    .select('*, employee_departments(department)')
    .eq('org_id', orgId)
    .in('role', ['employee', 'client_servicing'])
    .order('name')

  if (error || !data) return []

  // People removed from the organisation are not offered for new work
  return data.filter((p) => p.is_active !== false).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    departments: p.employee_departments?.map((d: any) => d.department as Department) || [],
  }))
}

async function fetchTasks(ctx: OrgContext, filters?: TaskFilters): Promise<TaskWithRelations[]> {
  const { supabase, orgId } = ctx

  let query = supabase
    .from('tasks')
    .select(TASK_WITH_SUBTASKS)
    .eq('org_id', orgId)
    .order('deadline', { ascending: true })

  // Bounds are ISO instants computed in the browser, so "a day" means the
  // viewer's day rather than the server's (UTC) day. Either bound is optional.
  if (filters?.startDate) query = query.gte('deadline', filters.startDate)
  if (filters?.endDate) query = query.lte('deadline', filters.endDate)
  if (filters?.department) query = query.eq('department', filters.department)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.clientId) query = query.eq('client_id', filters.clientId)

  if (filters?.assignedTo) {
    const assignee = await assigneeOrFilter(supabase, orgId, filters.assignedTo)
    if (!assignee) return []
    query = query.or(assignee)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching tasks:', error)
    return []
  }
  return data || []
}

// ============ CLIENTS ============

export async function getClients(): Promise<Client[]> {
  const ctx = await getOrgContext()
  return ctx ? fetchClients(ctx) : []
}

// Clients, employees (with departments) and the org id in a single round trip.
// Server actions run one at a time, so the screens that used to call
// getClients + getOrgEmployees + getProfile separately waited for all three.
export async function getTaskFormOptions(): Promise<TaskFormOptions> {
  const ctx = await getOrgContext()
  if (!ctx) return { clients: [], employees: [], orgId: null }

  const [clients, employees] = await Promise.all([fetchClients(ctx), fetchOrgEmployees(ctx)])
  return { clients, employees, orgId: ctx.orgId }
}

// First load of the admin Tasks page: the task list plus the form options.
export async function getTasksPageData(
  filters?: TaskFilters
): Promise<TaskFormOptions & { tasks: TaskWithRelations[] }> {
  const ctx = await getOrgContext()
  if (!ctx) return { tasks: [], clients: [], employees: [], orgId: null }

  const [tasks, clients, employees] = await Promise.all([
    fetchTasks(ctx, filters),
    fetchClients(ctx),
    fetchOrgEmployees(ctx),
  ])
  return { tasks, clients, employees, orgId: ctx.orgId }
}

export async function createClient_DB(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return { error: 'No organization found' }

  const name = formData.get('name') as string
  const type = formData.get('type') as string

  const { error } = await supabase.from('clients').insert({
    name,
    type,
    org_id: profile.org_id,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/clients')
  revalidatePath('/admin/tasks')
  return { success: true }
}

// ============ EMPLOYEES ============

export async function getEmployeesByDepartment(department: Department): Promise<EmployeeWithDepartments[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return []

  // Get employees in this department from the same org
  const { data, error } = await supabase
    .from('employee_departments')
    .select(`
      employee_id,
      department,
      profiles!inner (
        id,
        org_id,
        name,
        email
      )
    `)
    .eq('department', department)
    .eq('profiles.org_id', profile.org_id)

  if (error) {
    console.error('Error fetching employees:', error)
    return []
  }

  // Group by employee_id to get unique employees with their departments
  const employeesMap = new Map<string, { name: string | null; email: string; departments: Department[] }>()

  data?.forEach((item) => {
    const empId = item.employee_id
    const dept = item.department as Department
    const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles

    if (!profile) return

    if (!employeesMap.has(empId)) {
      employeesMap.set(empId, {
        name: profile.name,
        email: profile.email,
        departments: [],
      })
    }

    employeesMap.get(empId)!.departments.push(dept)
  })

  const employees: EmployeeWithDepartments[] = Array.from(employeesMap.entries()).map(([id, data]) => ({
    id,
    name: data.name,
    email: data.email,
    departments: data.departments,
  }))
  return employees
}

export async function getOrgEmployees(): Promise<EmployeeWithDepartments[]> {
  const ctx = await getOrgContext()
  return ctx ? fetchOrgEmployees(ctx) : []
}

// ============ TASKS ============

// Creating a task for anyone, and editing tasks, is for admins and client
// servicing. Employees add tasks for themselves through createOwnTask.
const CANNOT_ASSIGN = 'Only admins and client servicing can assign tasks to other people'

function canAssignOthers(ctx: OrgContext): boolean {
  return ctx.role === 'admin' || ctx.role === 'client_servicing'
}

export async function createTask(formData: FormData) {
  const ctx = await getOrgContext()
  if (!ctx) return { error: 'Not authenticated' }
  if (!canAssignOthers(ctx)) return { error: CANNOT_ASSIGN }
  const { supabase } = ctx
  const user = { id: ctx.userId }
  const profile = { org_id: ctx.orgId }

  const client_id = formData.get('client_id') as string
  const department = formData.get('department') as string
  const assigned_to = normalizeAssignee(formData.get('assigned_to'))
  const deadline = formData.get('deadline') as string
  const details = formData.get('details') as string
  const attachmentsJson = formData.get('attachments') as string
  const attachments = attachmentsJson ? JSON.parse(attachmentsJson) : []
  const subtasksJson = formData.get('subtasks') as string
  const subtasks = subtasksJson ? JSON.parse(subtasksJson) : []

  // If subtasks exist, calculate parent deadline as max of subtask deadlines
  let finalDeadline = deadline
  if (subtasks.length > 0) {
    const maxSubtaskDeadline = subtasks.reduce((max: string, st: any) => {
      return st.deadline > max ? st.deadline : max
    }, subtasks[0].deadline)
    finalDeadline = maxSubtaskDeadline
  }

  const { data, error } = await supabase.from('tasks').insert({
    client_id,
    department,
    assigned_to: assigned_to || null,
    deadline: finalDeadline,
    details: details || null,
    attachments,
    org_id: profile.org_id,
    created_by: user.id,
  }).select(`
    *,
    client:clients(*),
    assigned_employee:profiles!tasks_assigned_to_fkey(id, email, name)
  `).single()

  if (error) {
    return { error: error.message }
  }

  // Create subtasks if any
  if (subtasks.length > 0 && data) {
    const subtaskInserts = subtasks.map((st: any, index: number) => ({
      task_id: data.id,
      title: st.title,
      details: st.details || null,
      department: st.department,
      assigned_to: st.assigned_to || null,
      deadline: st.deadline,
      attachments: st.attachments || [],
      sort_order: index,
      org_id: profile.org_id,
    }))

    const { data: createdSubtasks, error: subtaskError } = await supabase
      .from('subtasks')
      .insert(subtaskInserts)
      .select(`
        *,
        assigned_employee:profiles!subtasks_assigned_to_fkey(id, email, name)
      `)

    if (subtaskError) {
      console.error('Error creating subtasks:', subtaskError)
      // Task was created but subtasks failed - could delete task or return partial success
    } else {
      // Attach subtasks to the returned task
      data.subtasks = createdSubtasks
    }
  }

  revalidatePath('/admin/tasks')
  return { success: true, task: data }
}

export async function getTasks(filters?: TaskFilters): Promise<TaskWithRelations[]> {
  const ctx = await getOrgContext()
  return ctx ? fetchTasks(ctx, filters) : []
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/tasks')
  revalidatePath('/employee')
  return { success: true }
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/tasks')
  return { success: true }
}

export async function getHistoryTasks(filters?: {
  page?: number
  limit?: number
  startDate?: string // ISO instant, inclusive
  endDate?: string // ISO instant, inclusive
  clientId?: string
  assignedTo?: string
}): Promise<PaginatedTasks> {
  const page = Math.max(1, filters?.page || 1)
  const limit = filters?.limit || 10
  const offset = (page - 1) * limit
  const empty: PaginatedTasks = { data: [], total: 0, page, limit, totalPages: 0 }

  const ctx = await getOrgContext()
  if (!ctx) return empty
  const { supabase, orgId } = ctx

  let query = supabase
    .from('tasks')
    .select(TASK_WITH_SUBTASKS, { count: 'exact' })
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })

  if (filters?.startDate) query = query.gte('updated_at', filters.startDate)
  if (filters?.endDate) query = query.lte('updated_at', filters.endDate)
  if (filters?.clientId) query = query.eq('client_id', filters.clientId)

  if (filters?.assignedTo) {
    // Also match tasks the employee works on through a subtask
    const assignee = await assigneeOrFilter(supabase, orgId, filters.assignedTo)
    if (!assignee) return empty
    query = query.or(assignee)
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching history tasks:', error)
    return empty
  }

  const total = count || 0
  return {
    data: data || [],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

// ============ PROFILE ============

export async function getProfile(userId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return { error: 'No organization found' }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .eq('org_id', profile.org_id)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { profile: data }
}

// ============ SUBTASKS ============

export async function createSubtask(taskId: string, subtaskData: {
  title: string
  details?: string
  department: Department
  assigned_to?: string
  deadline: string
  attachments?: any[]
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return { error: 'No organization found' }

  // Get current max sort_order for this task
  const { data: existingSubtasks } = await supabase
    .from('subtasks')
    .select('sort_order')
    .eq('task_id', taskId)
    .eq('org_id', profile.org_id)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSortOrder = existingSubtasks && existingSubtasks.length > 0 
    ? existingSubtasks[0].sort_order + 1 
    : 0

  const { data, error } = await supabase
    .from('subtasks')
    .insert({
      task_id: taskId,
      title: subtaskData.title,
      details: subtaskData.details || null,
      department: subtaskData.department,
      assigned_to: subtaskData.assigned_to || null,
      deadline: subtaskData.deadline,
      attachments: subtaskData.attachments || [],
      sort_order: nextSortOrder,
      org_id: profile.org_id,
    })
    .select(`
      *,
      assigned_employee:profiles!subtasks_assigned_to_fkey(id, email, name)
    `)
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/tasks')
  revalidatePath('/employee')
  return { success: true, subtask: data }
}

export async function updateSubtask(subtaskId: string, updates: {
  title?: string
  details?: string
  department?: Department
  assigned_to?: string | null
  deadline?: string
  status?: TaskStatus
  attachments?: any[]
}) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('subtasks')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subtaskId)
    .select(`
      *,
      assigned_employee:profiles!subtasks_assigned_to_fkey(id, email, name)
    `)
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/tasks')
  revalidatePath('/employee')
  return { success: true, subtask: data }
}

export async function updateSubtaskStatus(subtaskId: string, status: TaskStatus) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('subtasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', subtaskId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/tasks')
  revalidatePath('/employee')
  return { success: true }
}

export async function deleteSubtask(subtaskId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('subtasks')
    .delete()
    .eq('id', subtaskId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/tasks')
  revalidatePath('/employee')
  return { success: true }
}

export async function getTaskById(taskId: string): Promise<TaskWithRelations | null> {
  const ctx = await getOrgContext()
  if (!ctx) return null

  const { data, error } = await ctx.supabase
    .from('tasks')
    .select(TASK_WITH_SUBTASKS)
    .eq('id', taskId)
    .eq('org_id', ctx.orgId)
    .single()

  if (error) {
    console.error('Error fetching task:', error)
    return null
  }

  return data
}

// The edit form's "Unassigned" option submits a placeholder, not an id
function normalizeAssignee(value: FormDataEntryValue | null): string {
  return typeof value === 'string' && value !== 'unassigned' ? value : ''
}

export async function updateTask(taskId: string, formData: FormData) {
  const ctx = await getOrgContext()
  if (!ctx) return { error: 'Not authenticated' }
  if (!canAssignOthers(ctx)) return { error: CANNOT_ASSIGN }
  const { supabase } = ctx
  const profile = { org_id: ctx.orgId }

  const client_id = formData.get('client_id') as string
  const department = formData.get('department') as string
  const assigned_to = normalizeAssignee(formData.get('assigned_to'))
  const deadline = formData.get('deadline') as string
  const details = formData.get('details') as string
  const attachmentsJson = formData.get('attachments') as string
  const attachments = attachmentsJson ? JSON.parse(attachmentsJson) : []
  const subtasksJson = formData.get('subtasks') as string
  const subtasks = subtasksJson ? JSON.parse(subtasksJson) : []

  // Get existing subtasks to determine what to add/update/delete
  const { data: existingSubtasks } = await supabase
    .from('subtasks')
    .select('id')
    .eq('task_id', taskId)
    .eq('org_id', profile.org_id)

  const existingSubtaskIds = new Set(existingSubtasks?.map(st => st.id) || [])
  const newSubtaskIds = new Set(subtasks.filter((st: any) => st.id).map((st: any) => st.id))

  // Calculate deadline from subtasks if they exist
  let finalDeadline = deadline
  if (subtasks.length > 0) {
    const maxSubtaskDeadline = subtasks.reduce((max: string, st: any) => {
      return st.deadline > max ? st.deadline : max
    }, subtasks[0].deadline)
    finalDeadline = maxSubtaskDeadline
  }

  // Update the main task
  const { data: updatedTask, error: taskError } = await supabase
    .from('tasks')
    .update({
      client_id,
      department,
      assigned_to: assigned_to || null,
      deadline: finalDeadline,
      details: details || null,
      attachments,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select(`
      *,
      client:clients(*),
      assigned_employee:profiles!tasks_assigned_to_fkey(id, email, name)
    `)
    .single()

  if (taskError) {
    return { error: taskError.message }
  }

  const subtasksToDelete = [...existingSubtaskIds].filter(id => !newSubtaskIds.has(id))

  // Process subtasks: update existing, create new
  const subtasksToCreate: any[] = []
  const subtasksToUpdate: any[] = []

  subtasks.forEach((st: any, index: number) => {
    if (st.id && existingSubtaskIds.has(st.id)) {
      subtasksToUpdate.push({
        id: st.id,
        title: st.title,
        details: st.details || null,
        department: st.department,
        assigned_to: st.assigned_to || null,
        deadline: st.deadline,
        attachments: st.attachments || [],
        sort_order: index,
        updated_at: new Date().toISOString(),
      })
    } else {
      subtasksToCreate.push({
        task_id: taskId,
        title: st.title,
        details: st.details || null,
        department: st.department,
        assigned_to: st.assigned_to || null,
        deadline: st.deadline,
        attachments: st.attachments || [],
        sort_order: index,
        org_id: profile.org_id,
      })
    }
  })

  // Deletes, updates and inserts touch different rows, so run them together
  // instead of one round trip per subtask
  const writes = await Promise.all([
    subtasksToDelete.length > 0
      ? supabase.from('subtasks').delete().in('id', subtasksToDelete)
      : null,
    ...subtasksToUpdate.map(({ id, ...updateData }) =>
      supabase.from('subtasks').update(updateData).eq('id', id)
    ),
    subtasksToCreate.length > 0
      ? supabase.from('subtasks').insert(subtasksToCreate)
      : null,
  ])

  const failedWrite = writes.find((result) => result?.error)
  if (failedWrite?.error) {
    return { error: `Task saved, but a subtask change failed: ${failedWrite.error.message}` }
  }

  // Fetch the complete updated task with subtasks
  const { data: completeTask } = await supabase
    .from('tasks')
    .select(TASK_WITH_SUBTASKS)
    .eq('id', taskId)
    .single()

  // If task was completed but new subtask added, set status back to in_progress
  if (completeTask && completeTask.subtasks && completeTask.subtasks.length > 0) {
    const hasIncomplete = completeTask.subtasks.some((st: any) => st.status !== 'completed')
    if (hasIncomplete && updatedTask.status === 'completed') {
      await supabase
        .from('tasks')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', taskId)
      completeTask.status = 'in_progress'
    }
  }

  revalidatePath('/admin/tasks')
  revalidatePath('/employee')
  return { success: true, task: completeTask }
}