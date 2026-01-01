'use server'

import { createClient } from '@/lib/supabase/server'
import type { 
  EmployeeHourlyRate, 
  ClientManHours, 
  ClientProfitability, 
  EmployeePerformance,
  AnalyticsSummary,
  Department,
  WORKING_DAYS_PER_MONTH,
  WORKING_HOURS_PER_DAY
} from '@/types/database'

const WORKING_DAYS = 22
const WORKING_HOURS = 8

// ============ HELPERS ============

async function getOrgId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  return profile?.org_id || null
}

function calculateHourlyRate(ctcPerMonth: number): number {
  return ctcPerMonth / (WORKING_DAYS * WORKING_HOURS)
}

// ============ EMPLOYEE HOURLY RATES ============

export async function getEmployeeHourlyRates(): Promise<EmployeeHourlyRate[]> {
  const supabase = await createClient()
  const orgId = await getOrgId()
  if (!orgId) return []

  const { data: employees, error } = await supabase
    .from('profiles')
    .select(`
      id,
      name,
      email,
      ctc_per_month,
      employee_departments (department)
    `)
    .eq('org_id', orgId)
    .eq('role', 'employee')

  if (error || !employees) return []

  return employees.map(emp => ({
    id: emp.id,
    name: emp.name,
    email: emp.email,
    ctcPerMonth: emp.ctc_per_month || 0,
    hourlyRate: calculateHourlyRate(emp.ctc_per_month || 0),
    departments: emp.employee_departments?.map((d: { department: Department }) => d.department) || [],
  }))
}

export async function updateEmployeeCTC(employeeId: string, ctcPerMonth: number) {
  const supabase = await createClient()
  const orgId = await getOrgId()
  if (!orgId) return { error: 'Not authenticated' }

  // Verify employee belongs to same org
  const { data: employee } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', employeeId)
    .single()

  if (employee?.org_id !== orgId) {
    return { error: 'Not authorized' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ 
      ctc_per_month: ctcPerMonth,
      updated_at: new Date().toISOString()
    })
    .eq('id', employeeId)

  if (error) return { error: error.message }
  return { success: true }
}

// ============ CLIENT MAN HOURS ============

export async function getClientManHours(
  startDate: string,
  endDate: string
): Promise<ClientManHours[]> {
  const supabase = await createClient()
  const orgId = await getOrgId()
  if (!orgId) return []

  // Get all time logs in date range with task and client info
  const { data: timeLogs, error } = await supabase
    .from('time_logs')
    .select(`
      id,
      employee_id,
      duration,
      task:tasks!inner (
        id,
        client_id,
        client:clients!inner (
          id,
          name,
          type
        )
      )
    `)
    .eq('org_id', orgId)
    .gte('log_date', startDate)
    .lte('log_date', endDate)

  if (error || !timeLogs) return []

  // Get employee names
  const { data: employees } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('org_id', orgId)

  const employeeMap = new Map(employees?.map(e => [e.id, e.name]) || [])

  // Aggregate by client
  const clientMap = new Map<string, ClientManHours>()

  timeLogs.forEach(log => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = log.task as any
    if (!task?.client) return

    const clientId = task.client.id
    const duration = log.duration || 0

    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, {
        clientId,
        clientName: task.client.name,
        clientType: task.client.type as 'retainership' | 'project_basis',
        totalMinutes: 0,
        totalHours: 0,
        employeeBreakdown: [],
      })
    }

    const client = clientMap.get(clientId)!
    client.totalMinutes += duration

    // Update employee breakdown
    const existingEmp = client.employeeBreakdown.find(e => e.employeeId === log.employee_id)
    if (existingEmp) {
      existingEmp.minutes += duration
    } else {
      client.employeeBreakdown.push({
        employeeId: log.employee_id,
        employeeName: employeeMap.get(log.employee_id) || null,
        minutes: duration,
      })
    }
  })

  // Calculate total hours
  const results = Array.from(clientMap.values())
  results.forEach(client => {
    client.totalHours = Math.round((client.totalMinutes / 60) * 100) / 100
  })

  // Sort by total hours descending
  return results.sort((a, b) => b.totalHours - a.totalHours)
}

// ============ CLIENT PROFITABILITY ============

export async function getClientProfitability(
  startDate: string,
  endDate: string
): Promise<ClientProfitability[]> {
  const supabase = await createClient()
  const orgId = await getOrgId()
  if (!orgId) return []

  // Get clients with financial data
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('org_id', orgId)

  if (clientError || !clients) return []

  // Get employee hourly rates
  const employeeRates = await getEmployeeHourlyRates()
  const rateMap = new Map(employeeRates.map(e => [e.id, e.hourlyRate]))

  // Get time logs with employee info
  const { data: timeLogs } = await supabase
    .from('time_logs')
    .select(`
      employee_id,
      duration,
      task:tasks (
        client_id
      )
    `)
    .eq('org_id', orgId)
    .gte('log_date', startDate)
    .lte('log_date', endDate)

  // Get software subscriptions and costs
  const { data: software } = await supabase
    .from('software')
    .select('*, software_subscriptions(client_id)')
    .eq('org_id', orgId)

  // Get overheads
  const { data: overheads } = await supabase
    .from('overheads')
    .select('value_per_month')
    .eq('org_id', orgId)

  const totalOverhead = overheads?.reduce((sum, o) => sum + (o.value_per_month || 0), 0) || 0

  // Calculate months in date range
  const start = new Date(startDate)
  const end = new Date(endDate)
  const monthsInRange = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1)

  // Calculate retainership total for overhead apportionment
  const retainershipClients = clients.filter(c => c.type === 'retainership')
  const totalRetainershipValue = retainershipClients.reduce((sum, c) => sum + (c.monthly_value || 0), 0)

  // Aggregate labor costs and hours by client
  const laborCostMap = new Map<string, { cost: number; hours: number }>()
  
  timeLogs?.forEach(log => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = log.task as any
    if (!task?.client_id) return

    const hourlyRate = rateMap.get(log.employee_id) || 0
    const hours = (log.duration || 0) / 60
    const cost = hours * hourlyRate

    const existing = laborCostMap.get(task.client_id) || { cost: 0, hours: 0 }
    existing.cost += cost
    existing.hours += hours
    laborCostMap.set(task.client_id, existing)
  })

  return clients.map(client => {
    // Calculate revenue
    const monthlyRevenue = client.type === 'retainership'
      ? client.monthly_value || 0
      : client.project_duration_months
        ? (client.project_value || 0) / client.project_duration_months
        : 0

    const totalRevenue = client.type === 'retainership'
      ? monthlyRevenue * monthsInRange
      : client.project_value || 0

    // Calculate software cost for this client
    let softwareCost = 0
    software?.forEach(sw => {
      const subs = sw.software_subscriptions as { client_id: string }[] | null
      const isSubscribed = subs?.some(s => s.client_id === client.id)
      if (isSubscribed && subs) {
        softwareCost += sw.value_per_month / subs.length
      }
    })
    softwareCost *= monthsInRange

    // Calculate overhead cost (only for retainership clients)
    let overheadCost = 0
    if (client.type === 'retainership' && totalRetainershipValue > 0) {
      const share = (client.monthly_value || 0) / totalRetainershipValue
      overheadCost = totalOverhead * share * monthsInRange
    }

    // Get labor cost
    const labor = laborCostMap.get(client.id) || { cost: 0, hours: 0 }
    const laborCost = labor.cost
    const totalHours = Math.round(labor.hours * 100) / 100

    const totalCost = laborCost + softwareCost + overheadCost
    const grossProfit = totalRevenue - totalCost
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    const effectiveHourlyRevenue = totalHours > 0 ? totalRevenue / totalHours : 0

    return {
      clientId: client.id,
      clientName: client.name,
      clientType: client.type as 'retainership' | 'project_basis',
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      laborCost: Math.round(laborCost * 100) / 100,
      softwareCost: Math.round(softwareCost * 100) / 100,
      overheadCost: Math.round(overheadCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100,
      totalHours,
      effectiveHourlyRevenue: Math.round(effectiveHourlyRevenue * 100) / 100,
    }
  }).sort((a, b) => b.grossProfit - a.grossProfit)
}

// ============ EMPLOYEE PERFORMANCE ============

export async function getEmployeePerformance(
  startDate: string,
  endDate: string
): Promise<EmployeePerformance[]> {
  const supabase = await createClient()
  const orgId = await getOrgId()
  if (!orgId) return []

  // Get employees with CTC
  const employeeRates = await getEmployeeHourlyRates()

  // Get tasks assigned to employees in date range
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, assigned_to, status, deadline, updated_at')
    .eq('org_id', orgId)
    .gte('deadline', startDate)
    .lte('deadline', endDate)

  // Get time logs
  const { data: timeLogs } = await supabase
    .from('time_logs')
    .select('employee_id, duration')
    .eq('org_id', orgId)
    .gte('log_date', startDate)
    .lte('log_date', endDate)

  // Aggregate by employee
  const perfMap = new Map<string, {
    tasksAssigned: number
    tasksCompleted: number
    tasksOnTime: number
    totalMinutes: number
  }>()

  // Initialize for all employees
  employeeRates.forEach(emp => {
    perfMap.set(emp.id, {
      tasksAssigned: 0,
      tasksCompleted: 0,
      tasksOnTime: 0,
      totalMinutes: 0,
    })
  })

  // Aggregate tasks
  tasks?.forEach(task => {
    if (!task.assigned_to) return
    
    const perf = perfMap.get(task.assigned_to)
    if (!perf) return

    perf.tasksAssigned++
    
    if (task.status === 'completed') {
      perf.tasksCompleted++
      
      // Check if completed on time
      const deadline = new Date(task.deadline)
      const completedAt = new Date(task.updated_at)
      if (completedAt <= deadline) {
        perf.tasksOnTime++
      }
    }
  })

  // Aggregate time logs
  timeLogs?.forEach(log => {
    const perf = perfMap.get(log.employee_id)
    if (perf) {
      perf.totalMinutes += log.duration || 0
    }
  })

  return employeeRates.map(emp => {
    const perf = perfMap.get(emp.id)!
    const totalHoursLogged = Math.round((perf.totalMinutes / 60) * 100) / 100
    const completionRate = perf.tasksAssigned > 0 
      ? (perf.tasksCompleted / perf.tasksAssigned) * 100 
      : 0
    const onTimeRate = perf.tasksCompleted > 0 
      ? (perf.tasksOnTime / perf.tasksCompleted) * 100 
      : 0
    const avgHoursPerTask = perf.tasksCompleted > 0 
      ? totalHoursLogged / perf.tasksCompleted 
      : 0

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      email: emp.email,
      departments: emp.departments,
      tasksAssigned: perf.tasksAssigned,
      tasksCompleted: perf.tasksCompleted,
      tasksOnTime: perf.tasksOnTime,
      completionRate: Math.round(completionRate * 100) / 100,
      onTimeRate: Math.round(onTimeRate * 100) / 100,
      totalHoursLogged,
      avgHoursPerTask: Math.round(avgHoursPerTask * 100) / 100,
      hourlyRate: emp.hourlyRate,
      valueGenerated: Math.round(totalHoursLogged * emp.hourlyRate * 100) / 100,
    }
  }).sort((a, b) => b.totalHoursLogged - a.totalHoursLogged)
}

// ============ ANALYTICS SUMMARY ============

export async function getAnalyticsSummary(
  startDate: string,
  endDate: string
): Promise<AnalyticsSummary> {
  const [employeeRates, clientProfitability] = await Promise.all([
    getEmployeeHourlyRates(),
    getClientProfitability(startDate, endDate),
  ])

  const totalEmployees = employeeRates.filter(e => e.ctcPerMonth > 0).length
  const avgHourlyRate = totalEmployees > 0
    ? employeeRates.reduce((sum, e) => sum + e.hourlyRate, 0) / totalEmployees
    : 0

  const totalRevenue = clientProfitability.reduce((sum, c) => sum + c.totalRevenue, 0)
  const totalCost = clientProfitability.reduce((sum, c) => sum + c.totalCost, 0)
  const totalHoursLogged = clientProfitability.reduce((sum, c) => sum + c.totalHours, 0)
  const netProfit = totalRevenue - totalCost
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  return {
    totalHoursLogged: Math.round(totalHoursLogged * 100) / 100,
    totalEmployees,
    avgHourlyRate: Math.round(avgHourlyRate * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100,
  }
}
