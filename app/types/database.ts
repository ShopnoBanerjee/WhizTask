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
