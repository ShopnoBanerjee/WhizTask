'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Client, Department, Task, TaskStatus, TaskWithRelations, EmployeeWithDepartments, PaginatedTasks } from '@/types/database'

// ============ CLIENTS ============

export async function getClients(): Promise<Client[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
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

  const { data, error } = await supabase.from('tasks').insert({
    client_id,
    department,
    assigned_to: assigned_to || null,
    deadline,
    details: details || null,
    attachments,
    org_id: profile.org_id,
    created_by: user.id,
  }).select().single()

  if (error) {
    return { error: error.message }
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
}): Promise<TaskWithRelations[]> {
  const supabase = await createClient()

  let query = supabase
    .from('tasks')
    .select(`
      *,
      client:clients(*)
    `)
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

  let query = supabase
    .from('tasks')
    .select(`
      *,
      client:clients(*),
      assigned_employee:profiles!tasks_assigned_to_fkey(id, email)
    `, { count: 'exact' })
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

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { profile: data }
}
