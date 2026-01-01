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
  Profile
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

  // Update profile to mark onboarding as complete
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ 
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
}): Promise<TaskWithRelations[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('tasks')
    .select(`
      *,
      client:clients(*)
    `)
    .eq('assigned_to', user.id)
    .order('deadline', { ascending: true })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.startDate && filters?.endDate) {
    query = query
      .gte('deadline', filters.startDate)
      .lte('deadline', filters.endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching employee tasks:', error)
    return []
  }

  return data || []
}

export async function getEmployeeActiveTasks(): Promise<TaskWithRelations[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      client:clients(*)
    `)
    .eq('assigned_to', user.id)
    .in('status', ['pending', 'in_progress'])
    .order('deadline', { ascending: true })

  if (error) {
    console.error('Error fetching active tasks:', error)
    return []
  }

  return data || []
}

export async function updateEmployeeTaskStatus(taskId: string, status: TaskStatus) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify task is assigned to this employee
  const { data: task } = await supabase
    .from('tasks')
    .select('assigned_to')
    .eq('id', taskId)
    .single()

  if (task?.assigned_to !== user.id) {
    return { error: 'Not authorized to update this task' }
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

// ============ TIME LOGS ============

export async function getTimeLogs(date: string): Promise<TimeLogWithTask[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('time_logs')
    .select(`
      *,
      task:tasks(
        *,
        client:clients(*)
      )
    `)
    .eq('employee_id', user.id)
    .eq('log_date', date)
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Error fetching time logs:', error)
    return []
  }

  return data || []
}

export async function createTimeLog(data: {
  taskId: string
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

  // Check for overlapping time logs
  const { data: existing } = await supabase
    .from('time_logs')
    .select('id, start_time, end_time')
    .eq('employee_id', user.id)
    .eq('log_date', data.logDate)

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

  // Get the log to check ownership and date
  const { data: log } = await supabase
    .from('time_logs')
    .select('*')
    .eq('id', logId)
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

  // Verify ownership
  const { data: log } = await supabase
    .from('time_logs')
    .select('employee_id')
    .eq('id', logId)
    .single()

  if (log?.employee_id !== user.id) {
    return { error: 'Not authorized' }
  }

  const { error } = await supabase
    .from('time_logs')
    .delete()
    .eq('id', logId)

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
  }>()

  let colorIndex = 0
  timeLogs.forEach(log => {
    const taskId = log.task_id
    if (!taskMap.has(taskId)) {
      taskMap.set(taskId, {
        taskName: log.task?.details?.substring(0, 30) || 'Untitled Task',
        clientName: log.task?.client?.name || 'Unknown Client',
        totalMinutes: 0,
        color: TASK_COLORS[colorIndex % TASK_COLORS.length],
      })
      colorIndex++
    }
    const entry = taskMap.get(taskId)!
    entry.totalMinutes += log.duration
  })

  const totalLogged = timeLogs.reduce((sum, log) => sum + log.duration, 0)

  return {
    totalLogged,
    remaining: 1440 - totalLogged, // 24 hours = 1440 minutes
    taskBreakdown: Array.from(taskMap.entries()).map(([taskId, data]) => ({
      taskId,
      ...data,
    })),
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

  const page = filters?.page || 1
  const limit = filters?.limit || 10
  const offset = (page - 1) * limit

  let query = supabase
    .from('tasks')
    .select(`
      *,
      client:clients(*)
    `, { count: 'exact' })
    .eq('assigned_to', user.id)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })

  if (filters?.startDate && filters?.endDate) {
    query = query
      .gte('updated_at', filters.startDate)
      .lte('updated_at', filters.endDate)
  }

  const { data, error, count } = await query
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching task history:', error)
    return { data: [], total: 0, page, limit, totalPages: 0 }
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return { data: data || [], total, page, limit, totalPages }
}
