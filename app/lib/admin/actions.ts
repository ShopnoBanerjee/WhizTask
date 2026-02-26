'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Client, Department, Task, TaskStatus, TaskWithRelations, EmployeeWithDepartments, PaginatedTasks, Subtask, SubtaskWithRelations } from '@/types/database'

// ============ CLIENTS ============

export async function getClients(): Promise<Client[]> {
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
    console.error('Error fetching clients:', error)
    return []
  }

  return data || []
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
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return []

  // Get all employees with their departments
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      name,
      email,
      employee_departments (
        department
      )
    `)
    .eq('org_id', profile.org_id)
    .eq('role', 'employee')

  if (error || !data) return []

  const employees: EmployeeWithDepartments[] = data.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    departments: p.employee_departments?.map((d: any) => d.department as Department) || [],
  }))

  return employees
}

// ============ TASKS ============

export async function createTask(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return { error: 'No organization found' }

  const client_id = formData.get('client_id') as string
  const department = formData.get('department') as string
  const assigned_to = formData.get('assigned_to') as string
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

export async function getTasks(filters?: {
  date?: string
  startDate?: string
  endDate?: string
  department?: Department
  assignedTo?: string
  status?: TaskStatus
  clientId?: string // added so admin page can filter by client like history
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

  let query = supabase
    .from('tasks')
    .select(`
      *,
      client:clients(*),
      assigned_employee:profiles!tasks_assigned_to_fkey(id, email, name),
      subtasks(
        *,
        assigned_employee:profiles!subtasks_assigned_to_fkey(id, email, name)
      )
    `)
    .eq('org_id', profile.org_id)
    .order('deadline', { ascending: true })

  if (filters?.date) {
    const startOfDay = new Date(filters.date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(filters.date)
    endOfDay.setHours(23, 59, 59, 999)
    
    query = query
      .gte('deadline', startOfDay.toISOString())
      .lte('deadline', endOfDay.toISOString())
  }

  if (filters?.startDate && filters?.endDate) {
    query = query
      .gte('deadline', filters.startDate)
      .lte('deadline', filters.endDate)
  }

  if (filters?.department) {
    query = query.eq('department', filters.department)
  }

  if (filters?.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  // advanced filtering added for admin task page
  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching tasks:', error)
    return []
  }

  return data || []
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
  startDate?: string
  endDate?: string
  clientId?: string
  assignedTo?: string
}): Promise<PaginatedTasks> {
  const supabase = await createClient()

  const page = filters?.page || 1
  const limit = filters?.limit || 10
  const offset = (page - 1) * limit

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) {
    return {
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0
    }
  }

  let query = supabase
    .from('tasks')
    .select(`
      *,
      client:clients(*),
      assigned_employee:profiles!tasks_assigned_to_fkey(id, email, name)
    `, { count: 'exact' })
    .eq('org_id', profile.org_id)
    .order('updated_at', { ascending: false })

  if (filters?.startDate && filters?.endDate) {
    query = query
      .gte('updated_at', filters.startDate)
      .lte('updated_at', filters.endDate)
  }

  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId)
  }

  if (filters?.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo)
  }

  const { data, error, count } = await query
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching history tasks:', error)
    return {
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0
    }
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return {
    data: data || [],
    total,
    page,
    limit,
    totalPages
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
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return null

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      client:clients(*),
      assigned_employee:profiles!tasks_assigned_to_fkey(id, email, name),
      subtasks(
        *,
        assigned_employee:profiles!subtasks_assigned_to_fkey(id, email, name)
      )
    `)
    .eq('id', taskId)
    .eq('org_id', profile.org_id)
    .single()

  if (error) {
    console.error('Error fetching task:', error)
    return null
  }

  return data
}

export async function updateTask(taskId: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return { error: 'No organization found' }

  const client_id = formData.get('client_id') as string
  const department = formData.get('department') as string
  const assigned_to = formData.get('assigned_to') as string
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

  // Delete removed subtasks
  const subtasksToDelete = [...existingSubtaskIds].filter(id => !newSubtaskIds.has(id))
  if (subtasksToDelete.length > 0) {
    await supabase.from('subtasks').delete().in('id', subtasksToDelete)
  }

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

  // Update existing subtasks
  for (const st of subtasksToUpdate) {
    const { id, ...updateData } = st
    await supabase.from('subtasks').update(updateData).eq('id', id)
  }

  // Create new subtasks
  if (subtasksToCreate.length > 0) {
    await supabase.from('subtasks').insert(subtasksToCreate)
  }

  // Fetch the complete updated task with subtasks
  const { data: completeTask } = await supabase
    .from('tasks')
    .select(`
      *,
      client:clients(*),
      assigned_employee:profiles!tasks_assigned_to_fkey(id, email, name),
      subtasks(
        *,
        assigned_employee:profiles!subtasks_assigned_to_fkey(id, email, name)
      )
    `)
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