'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { 
  Department, 
  TaskWithRelations, 
  TaskStatus,
  TimeLog,
  TimeLogWithTask,
  DailyTimeStats,
  TASK_COLORS,
  Profile,
  SubtaskWithRelations,
  Client
} from '@/types/database'

// ============ DEPARTMENTS ============

export async function saveEmployeeDepartments(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  const departments = formData.getAll('departments') as Department[]

  if (departments.length === 0) {
    redirect('/employee/onboarding?error=Please select at least one department')
  }

  // determine new role - client_servicing users keep employee privileges
  const newRole: 'employee' | 'client_servicing' =
    departments.includes('client_servicing') ? 'client_servicing' : 'employee'

  console.log('saveEmployeeDepartments', {
    user: user.id,
    departments,
    newRole,
  })

  // Delete existing departments for this employee
  await supabase
    .from('employee_departments')
    .delete()
    .eq('employee_id', user.id)

  // Insert new departments
  const { error: insertError } = await supabase
    .from('employee_departments')
    .insert(
      departments.map((dept) => ({
        employee_id: user.id,
        department: dept,
      }))
    )

  if (insertError) {
    redirect(`/employee/onboarding?error=${encodeURIComponent(insertError.message)}`)
  }

  // Update profile to mark onboarding as complete and set role
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ 
      role: newRole,
      has_completed_onboarding: true,
      updated_at: new Date().toISOString() 
    })
    .eq('id', user.id)

  if (updateError) {
    redirect(`/employee/onboarding?error=${encodeURIComponent(updateError.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/employee')
}

export async function getEmployeeDepartments(): Promise<Department[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('employee_departments')
    .select('department')
    .eq('employee_id', user.id)

  return data?.map((d) => d.department as Department) || []
}

// ============ EMPLOYEE PROFILE ============

export async function getEmployeeProfile(): Promise<Profile | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) return null
  return data
}

export async function updateEmployeeProfile(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const name = formData.get('name') as string

  const { error } = await supabase
    .from('profiles')
    .update({ 
      name,
      updated_at: new Date().toISOString() 
    })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/employee')
  return { success: true }
}

// ============ EMPLOYEE TASKS ============

export async function getEmployeeTasks(filters?: {
  status?: TaskStatus
  startDate?: string
  endDate?: string
  clientId?: string
}): Promise<TaskWithRelations[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return []

  // Get tasks directly assigned to user (limited to org)
  let directQuery = supabase
    .from('tasks')
    .select(`
      *,
      client:clients(*),
      subtasks(
        *,
        assigned_employee:profiles!subtasks_assigned_to_fkey(id, name, email)
      )
    `)
    .eq('assigned_to', user.id)
    .eq('org_id', profile.org_id)
    .order('deadline', { ascending: true })

  // Get tasks where user has assigned subtasks (limited to org)
  let subtaskQuery = supabase
    .from('subtasks')
    .select('task_id')
    .eq('assigned_to', user.id)
    .eq('org_id', profile.org_id)

  if (filters?.status) {
    directQuery = directQuery.eq('status', filters.status)
  }

  if (filters?.startDate && filters?.endDate) {
    directQuery = directQuery
      .gte('deadline', filters.startDate)
      .lte('deadline', filters.endDate)
  }

  if (filters?.clientId) {
    directQuery = directQuery.eq('client_id', filters.clientId)
  }

  const [directResult, subtaskResult] = await Promise.all([
    directQuery,
    subtaskQuery
  ])

  if (directResult.error) {
    console.error('Error fetching employee tasks:', JSON.stringify(directResult.error))
    return []
  }

  // Get unique task IDs from subtasks
  const subtaskTaskIds = [...new Set(subtaskResult.data?.map(s => s.task_id) || [])]
  const directTaskIds = directResult.data?.map(t => t.id) || []
  
  // Filter out tasks already in direct results
  const additionalTaskIds = subtaskTaskIds.filter(id => !directTaskIds.includes(id))

  let allTasks = directResult.data || []

  // Fetch additional tasks where user has subtasks
  if (additionalTaskIds.length > 0) {
    let additionalQuery = supabase
      .from('tasks')
      .select(`
        *,
        client:clients(*),
        subtasks(
          *,
          assigned_employee:profiles!subtasks_assigned_to_fkey(id, name, email)
        )
      `)
      .in('id', additionalTaskIds)
      .eq('org_id', profile.org_id)
      .order('deadline', { ascending: true })

    if (filters?.status) {
      additionalQuery = additionalQuery.eq('status', filters.status)
    }

    if (filters?.startDate && filters?.endDate) {
      additionalQuery = additionalQuery
        .gte('deadline', filters.startDate)
        .lte('deadline', filters.endDate)
    }
    if (filters?.clientId) {
      additionalQuery = additionalQuery.eq('client_id', filters.clientId)
    }

    const { data: additionalTasks } = await additionalQuery
    if (additionalTasks) {
      allTasks = [...allTasks, ...additionalTasks]
    }
  }

  // Sort by deadline
  allTasks.sort((a, b) => {
    const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity
    const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity
    return dateA - dateB
  })

  return allTasks
}

// === helpers ===

export async function getEmployeeClients(): Promise<Client[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return []

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('org_id', profile.org_id)
    .order('name')

  if (error) {
    console.error('Error fetching clients for employee:', error)
    return []
  }

  return data || []
}

export async function getEmployeeActiveTasks(): Promise<TaskWithRelations[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return []

  // Get tasks directly assigned to user (limited to org)
  const { data: directTasks, error: directError } = await supabase
    .from('tasks')
    .select(`
      *,
      client:clients(*),
      subtasks(
        *,
        assigned_employee:profiles!subtasks_assigned_to_fkey(id, name, email)
      )
    `)
    .eq('assigned_to', user.id)
    .eq('org_id', profile.org_id)
    .in('status', ['pending', 'in_progress'])
    .order('deadline', { ascending: true })

  if (directError) {
    console.error('Error fetching active tasks:', JSON.stringify(directError))
    return []
  }

  // Get tasks where user has subtasks assigned (that are not completed)
  const { data: subtaskData } = await supabase
    .from('subtasks')
    .select('task_id')
    .eq('assigned_to', user.id)
    .eq('org_id', profile.org_id)
    .in('status', ['pending', 'in_progress'])

  const subtaskTaskIds = [...new Set(subtaskData?.map(s => s.task_id) || [])]
  const directTaskIds = directTasks?.map(t => t.id) || []
  const additionalTaskIds = subtaskTaskIds.filter(id => !directTaskIds.includes(id))

  let allTasks = directTasks || []

  if (additionalTaskIds.length > 0) {
    const { data: additionalTasks } = await supabase
      .from('tasks')
      .select(`
        *,
        client:clients(*),
        subtasks(
          *,
          assigned_employee:profiles!subtasks_assigned_to_fkey(id, name, email)
        )
      `)
      .in('id', additionalTaskIds)
      .eq('org_id', profile.org_id)
      .in('status', ['pending', 'in_progress'])
      .order('deadline', { ascending: true })

    if (additionalTasks) {
      allTasks = [...allTasks, ...additionalTasks]
    }
  }

  // Sort by deadline
  allTasks.sort((a, b) => {
    const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity
    const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity
    return dateA - dateB
  })

  return allTasks
}

// Get subtasks specifically assigned to the current employee
export async function getEmployeeSubtasks(filters?: {
  status?: TaskStatus
  taskId?: string
}): Promise<SubtaskWithRelations[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return []

  let query = supabase
    .from('subtasks')
    .select(`
      *,
      assigned_employee:profiles!subtasks_assigned_to_fkey(id, name, email),
      task:tasks(
        *,
        client:clients(*)
      )
    `)
    .eq('assigned_to', user.id)
    .eq('org_id', profile.org_id)
    .order('deadline', { ascending: true })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.taskId) {
    query = query.eq('task_id', filters.taskId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching employee subtasks:', error)
    return []
  }

  return data || []
}

export async function updateEmployeeTaskStatus(taskId: string, status: TaskStatus) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return { error: 'No organization found' }

  // Verify task is assigned to this employee and has no subtasks
  const { data: task } = await supabase
    .from('tasks')
    .select('assigned_to, id')
    .eq('id', taskId)
    .eq('org_id', profile.org_id)
    .single()

  if (task?.assigned_to !== user.id) {
    return { error: 'Not authorized to update this task' }
  }

  // Check if task has subtasks - if so, status should be auto-derived
  const { data: subtasks } = await supabase
    .from('subtasks')
    .select('id')
    .eq('task_id', taskId)
    .eq('org_id', profile.org_id)
    .limit(1)

  if (subtasks && subtasks.length > 0) {
    return { error: 'Cannot manually update status for tasks with subtasks. Update subtask statuses instead.' }
  }

  const { error } = await supabase
    .from('tasks')
    .update({ 
      status, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', taskId)

  if (error) return { error: error.message }

  revalidatePath('/employee')
  return { success: true }
}

// Update subtask status (employee can only update their assigned subtasks)
export async function updateEmployeeSubtaskStatus(subtaskId: string, status: TaskStatus) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return { error: 'No organization found' }

  // Verify subtask is assigned to this employee
  const { data: subtask } = await supabase
    .from('subtasks')
    .select('assigned_to, task_id')
    .eq('id', subtaskId)
    .eq('org_id', profile.org_id)
    .single()

  if (subtask?.assigned_to !== user.id) {
    return { error: 'Not authorized to update this subtask' }
  }

  const { error } = await supabase
    .from('subtasks')
    .update({ 
      status, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', subtaskId)

  if (error) return { error: error.message }

  // The parent task status will be auto-updated by the database trigger

  revalidatePath('/employee')
  return { success: true }
}

// ============ TIME LOGS ============

export async function getTimeLogs(date: string): Promise<TimeLogWithTask[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return []

  const { data, error } = await supabase
    .from('time_logs')
    .select(`
      *,
      task:tasks(
        *,
        client:clients(*)
      ),
      subtask:subtasks(
        id,
        title,
        status,
        deadline
      )
    `)
    .eq('employee_id', user.id)
    .eq('log_date', date)
    .eq('org_id', profile.org_id)
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Error fetching time logs:', error)
    return []
  }

  return data || []
}

export async function createTimeLog(data: {
  taskId: string
  subtaskId?: string | null
  logDate: string
  startTime: number
  endTime: number
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

  // If subtaskId is provided, verify it belongs to the task and is assigned to user
  if (data.subtaskId) {
    const { data: subtask } = await supabase
      .from('subtasks')
      .select('task_id, assigned_to')
      .eq('id', data.subtaskId)
      .eq('org_id', profile.org_id)
      .single()

    if (!subtask) {
      return { error: 'Subtask not found' }
    }
    if (subtask.task_id !== data.taskId) {
      return { error: 'Subtask does not belong to this task' }
    }
    if (subtask.assigned_to !== user.id) {
      return { error: 'Subtask is not assigned to you' }
    }
  }

  // Check for overlapping time logs
  const { data: existing } = await supabase
    .from('time_logs')
    .select('id, start_time, end_time')
    .eq('employee_id', user.id)
    .eq('log_date', data.logDate)
    .eq('org_id', profile.org_id)

  const hasOverlap = existing?.some(log => {
    return (data.startTime < log.end_time && data.endTime > log.start_time)
  })

  if (hasOverlap) {
    return { error: 'Time block overlaps with existing entry' }
  }

  const { data: newLog, error } = await supabase
    .from('time_logs')
    .insert({
      employee_id: user.id,
      task_id: data.taskId,
      subtask_id: data.subtaskId || null,
      log_date: data.logDate,
      start_time: data.startTime,
      end_time: data.endTime,
      org_id: profile.org_id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/employee')
  return { success: true, timeLog: newLog }
}

export async function updateTimeLog(
  logId: string, 
  data: { startTime: number; endTime: number }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return { error: 'No organization found' }

  // Get the log to check ownership and date
  const { data: log } = await supabase
    .from('time_logs')
    .select('*')
    .eq('id', logId)
    .eq('org_id', profile.org_id)
    .single()

  if (!log || log.employee_id !== user.id) {
    return { error: 'Not authorized' }
  }

  // Check for overlapping time logs (excluding current)
  const { data: existing } = await supabase
    .from('time_logs')
    .select('id, start_time, end_time')
    .eq('employee_id', user.id)
    .eq('log_date', log.log_date)
    .neq('id', logId)
    .eq('org_id', profile.org_id)

  const hasOverlap = existing?.some(other => {
    return (data.startTime < other.end_time && data.endTime > other.start_time)
  })

  if (hasOverlap) {
    return { error: 'Time block overlaps with existing entry' }
  }

  const { error } = await supabase
    .from('time_logs')
    .update({
      start_time: data.startTime,
      end_time: data.endTime,
      updated_at: new Date().toISOString(),
    })
    .eq('id', logId)

  if (error) return { error: error.message }

  revalidatePath('/employee')
  return { success: true }
}

export async function deleteTimeLog(logId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return { error: 'No organization found' }

  // Verify ownership
  const { data: log } = await supabase
    .from('time_logs')
    .select('employee_id')
    .eq('id', logId)
    .eq('org_id', profile.org_id)
    .single()

  if (log?.employee_id !== user.id) {
    return { error: 'Not authorized' }
  }

  const { error } = await supabase
    .from('time_logs')
    .delete()
    .eq('id', logId)
    .eq('org_id', profile.org_id)

  if (error) return { error: error.message }

  revalidatePath('/employee')
  return { success: true }
}

export async function getDailyTimeStats(date: string): Promise<DailyTimeStats> {
  const timeLogs = await getTimeLogs(date)
  
  const TASK_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  ]

  const taskMap = new Map<string, {
    taskName: string
    clientName: string
    totalMinutes: number
    color: string
    subtaskId?: string | null
    subtaskTitle?: string | null
  }>()

  let colorIndex = 0
  timeLogs.forEach(log => {
    // Use subtaskId as part of the key if present, so we track subtasks separately
    const key = log.subtask_id ? `${log.task_id}:${log.subtask_id}` : log.task_id
    
    if (!taskMap.has(key)) {
      const subtask = (log as any).subtask
      taskMap.set(key, {
        taskName: subtask?.title || log.task?.details?.substring(0, 30) || 'Untitled Task',
        clientName: log.task?.client?.name || 'Unknown Client',
        totalMinutes: 0,
        color: TASK_COLORS[colorIndex % TASK_COLORS.length],
        subtaskId: log.subtask_id ?? null,
        subtaskTitle: subtask?.title ?? null,
      })
      colorIndex++
    }
    const entry = taskMap.get(key)!
    entry.totalMinutes += log.duration
  })

  const totalLogged = timeLogs.reduce((sum, log) => sum + log.duration, 0)

  return {
    totalLogged,
    remaining: 1440 - totalLogged, // 24 hours = 1440 minutes
    taskBreakdown: Array.from(taskMap.entries()).map(([key, data]) => {
      // Extract taskId from the key (format: taskId or taskId:subtaskId)
      const taskId = key.includes(':') ? key.split(':')[0] : key
      return {
        taskId,
        subtaskId: data.subtaskId ?? null,
        subtaskTitle: data.subtaskTitle ?? null,
        taskName: data.taskName,
        clientName: data.clientName,
        totalMinutes: data.totalMinutes,
        color: data.color,
      }
    }),
  }
}

// ============ HISTORY ============

export async function getEmployeeTaskHistory(filters?: {
  page?: number
  limit?: number
  startDate?: string
  endDate?: string
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 }

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 }

  const page = filters?.page || 1
  const limit = filters?.limit || 10
  const offset = (page - 1) * limit

  // Get completed tasks directly assigned to user (limited to org)
  let directQuery = supabase
    .from('tasks')
    .select(`
      *,
      client:clients(*),
      subtasks(
        *,
        assigned_employee:profiles!subtasks_assigned_to_fkey(id, name, email)
      )
    `, { count: 'exact' })
    .eq('assigned_to', user.id)
    .eq('org_id', profile.org_id)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })

  if (filters?.startDate && filters?.endDate) {
    directQuery = directQuery
      .gte('updated_at', filters.startDate)
      .lte('updated_at', filters.endDate)
  }

  const { data: directTasks, error: directError, count: directCount } = await directQuery
    .range(offset, offset + limit - 1)

  if (directError) {
    console.error('Error fetching task history:', JSON.stringify(directError))
    return { data: [], total: 0, page, limit, totalPages: 0 }
  }

  // Also get tasks where user had completed subtasks
  const { data: completedSubtasks } = await supabase
    .from('subtasks')
    .select('task_id')
    .eq('assigned_to', user.id)
    .eq('org_id', profile.org_id)
    .eq('status', 'completed')

  const subtaskTaskIds = [...new Set(completedSubtasks?.map(s => s.task_id) || [])]
  const directTaskIds = directTasks?.map(t => t.id) || []
  const additionalTaskIds = subtaskTaskIds.filter(id => !directTaskIds.includes(id))

  let allTasks = directTasks || []

  if (additionalTaskIds.length > 0) {
    let additionalQuery = supabase
      .from('tasks')
      .select(`
        *,
        client:clients(*),
        subtasks(
          *,
          assigned_employee:profiles!subtasks_assigned_to_fkey(id, name, email)
        )
      `)
      .in('id', additionalTaskIds)
      .eq('org_id', profile.org_id)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })

    if (filters?.startDate && filters?.endDate) {
      additionalQuery = additionalQuery
        .gte('updated_at', filters.startDate)
        .lte('updated_at', filters.endDate)
    }

    const { data: additionalTasks } = await additionalQuery
    if (additionalTasks) {
      allTasks = [...allTasks, ...additionalTasks]
    }
  }

  // Sort by updated_at descending
  allTasks.sort((a, b) => {
    const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0
    const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0
    return dateB - dateA
  })

  const total = directCount || 0
  const totalPages = Math.ceil(total / limit)

  return { data: allTasks, total, page, limit, totalPages }
}
