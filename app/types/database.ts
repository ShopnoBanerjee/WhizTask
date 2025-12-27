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

export interface EmployeeWithDepartments {
  id: string
  email: string
  departments: Department[]
}

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB in bytes
