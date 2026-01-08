export type Department =
  | 'planning'
  | 'client_servicing'
  | 'design'
  | 'content'
  | 'editing'
  | 'shooting'
  | 'seo'
  | 'web_design'
  | 'posting_reporting'
  | 'online_ads'

export const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'client_servicing', label: 'Client Servicing' },
  { value: 'design', label: 'Design' },
  { value: 'content', label: 'Content' },
  { value: 'editing', label: 'Editing' },
  { value: 'shooting', label: 'Shooting' },
  { value: 'seo', label: 'SEO' },
  { value: 'web_design', label: 'Web Design' },
  { value: 'posting_reporting', label: 'Posting & Reporting' },
  { value: 'online_ads', label: 'Online Ads' },
]

export type ClientType = 'retainership' | 'project_basis'

export const CLIENT_TYPES: { value: ClientType; label: string }[] = [
  { value: 'retainership', label: 'Retainership' },
  { value: 'project_basis', label: 'Project Basis' },
]

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue'

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
]

export interface Profile {
  id: string
  role: 'admin' | 'employee'
  org_id: string | null
  name: string | null
  email: string
  ctc_per_month: number | null // Cost to Company per month in INR
  is_org_verified: boolean
  has_completed_onboarding: boolean
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  name: string
  type: ClientType
  org_id: string
  created_at: string
  updated_at: string
}

export interface EmployeeDepartment {
  id: string
  employee_id: string
  department: Department
  created_at: string
}

export interface TaskAttachment {
  name: string
  path: string
  size: number
}

export interface Task {
  id: string
  client_id: string
  department: Department
  assigned_to: string | null
  deadline: string
  details: string | null
  attachments: TaskAttachment[]
  status: TaskStatus
  org_id: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TaskWithRelations extends Task {
  client: Client
  assigned_employee?: {
    id: string
    email: string
    name: string
  }
}

export interface PaginatedTasks {
  data: TaskWithRelations[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface EmployeeWithDepartments {
  id: string
  name: string | null
  email: string
  departments: Department[]
}

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB in bytes

// ============ CLIENT FINANCIAL TYPES ============

export interface ClientContact {
  email?: string
  phone?: string
  address?: string
}

export interface ClientFull {
  id: string
  name: string
  type: ClientType
  contact: ClientContact
  monthly_value: number // For retainership
  project_value: number | null // For project basis
  project_duration_months: number | null // For project basis
  org_id: string
  created_at: string
  updated_at: string
}

export interface ClientWithCalculations extends ClientFull {
  effective_monthly_value: number // project_value / duration or monthly_value
  software_cost: number // Apportioned software cost
  overhead_cost: number // Apportioned overhead cost
  net_value: number // effective_monthly_value - software_cost - overhead_cost
  subscribed_software: Software[]
}

// ============ SOFTWARE TYPES ============

export interface Software {
  id: string
  name: string
  value_per_month: number
  org_id: string
  created_at: string
  updated_at: string
}

export interface SoftwareSubscription {
  id: string
  software_id: string
  client_id: string
  created_at: string
}

export interface SoftwareWithSubscribers extends Software {
  subscribers: { id: string; name: string }[]
  apportioned_cost: number // value_per_month / subscribers.length
}

// ============ OVERHEAD TYPES ============

export type OverheadCategory = 'rent' | 'board_salary' | 'electricity' | 'maintenance' | 'others'

export const OVERHEAD_CATEGORIES: { value: OverheadCategory; label: string }[] = [
  { value: 'rent', label: 'Rent' },
  { value: 'board_salary', label: 'Board Salary' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'others', label: 'Others' },
]

export interface Overhead {
  id: string
  category: OverheadCategory
  value_per_month: number
  org_id: string
  created_at: string
  updated_at: string
}

// ============ AUDIT LOG TYPES ============

export type AuditAction = 'create' | 'update' | 'delete'
export type AuditEntity = 'client' | 'software' | 'overhead' | 'subscription'

export interface AuditLog {
  id: string
  entity_type: AuditEntity
  entity_id: string
  entity_name: string
  action: AuditAction
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  changed_by: string
  org_id: string
  created_at: string
}

export interface AuditLogWithUser extends AuditLog {
  user_email?: string
}

// ============ TIME LOG TYPES ============

export interface TimeLog {
  id: string
  employee_id: string
  task_id: string
  log_date: string // YYYY-MM-DD format
  start_time: number // minutes from midnight (0-1440)
  end_time: number // minutes from midnight (0-1440)
  duration: number // in minutes
  org_id: string
  created_at: string
  updated_at: string
}

export interface TimeLogWithTask extends TimeLog {
  task: TaskWithRelations
}

export interface TimeBlock {
  id: string
  taskId: string
  taskName: string
  clientName: string
  startTime: number // minutes from midnight
  endTime: number // minutes from midnight
  color: string
}

export interface DailyTimeStats {
  totalLogged: number // minutes
  remaining: number // minutes (1440 - totalLogged)
  taskBreakdown: {
    taskId: string
    taskName: string
    clientName: string
    totalMinutes: number
    color: string
  }[]
}

// Task colors for timeline blocks
export const TASK_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
] as const

// ============ ANALYTICS TYPES ============

export const WORKING_DAYS_PER_MONTH = 22
export const WORKING_HOURS_PER_DAY = 8

export interface EmployeeHourlyRate {
  id: string
  name: string | null
  email: string
  ctcPerMonth: number
  hourlyRate: number // ctc / (22 * 8)
  departments: Department[]
}

export interface ClientManHours {
  clientId: string
  clientName: string
  clientType: ClientType
  totalMinutes: number
  totalHours: number
  employeeBreakdown: {
    employeeId: string
    employeeName: string | null
    minutes: number
  }[]
}

export interface ClientProfitability {
  clientId: string
  clientName: string
  clientType: ClientType
  // Revenue
  monthlyRevenue: number
  totalRevenue: number // For project: project_value, for retainership: monthly * months in range
  // Costs
  laborCost: number // sum of (hours * employee hourly rate)
  softwareCost: number
  overheadCost: number
  totalCost: number
  // Profit
  grossProfit: number // revenue - total cost
  profitMargin: number // (gross profit / revenue) * 100
  // Hours
  totalHours: number
  effectiveHourlyRevenue: number // revenue / hours
}

export interface EmployeePerformance {
  employeeId: string
  employeeName: string | null
  email: string
  departments: Department[]
  // Task metrics
  tasksAssigned: number
  tasksCompleted: number
  tasksOnTime: number // completed before deadline
  completionRate: number // (completed / assigned) * 100
  onTimeRate: number // (onTime / completed) * 100
  // Time metrics
  totalHoursLogged: number
  avgHoursPerTask: number
  // Productivity
  hourlyRate: number
  valueGenerated: number // hours * hourly rate
}

export interface AnalyticsSummary {
  totalHoursLogged: number
  totalEmployees: number
  avgHourlyRate: number
  totalRevenue: number
  totalCost: number
  netProfit: number
  profitMargin: number
}
