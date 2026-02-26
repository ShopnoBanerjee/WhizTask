import { TaskStatus, Department } from '@/types/database'

// Central color classes for task statuses
export const STATUS_COLOR_CLASSES: Record<TaskStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
}

// Assign each department a unique color combination (background + text)
// Feel free to adjust as needed; we use Tailwind utility classes
export const DEPARTMENT_COLOR_CLASSES: Record<Department, string> = {
  planning:        'bg-purple-100 text-purple-800',
  client_servicing:'bg-indigo-100 text-indigo-800',
  design:          'bg-pink-100 text-pink-800',
  content:         'bg-emerald-100 text-emerald-800',
  editing:         'bg-yellow-100 text-yellow-800',
  shooting:        'bg-orange-100 text-orange-800',
  seo:             'bg-teal-100 text-teal-800',
  web_design:      'bg-sky-100 text-sky-800',
  posting_reporting:'bg-fuchsia-100 text-fuchsia-800',
  online_ads:      'bg-rose-100 text-rose-800',
}

export function getStatusColor(status: TaskStatus) {
  return STATUS_COLOR_CLASSES[status] || ''
}

export function getDepartmentColor(department: Department) {
  return DEPARTMENT_COLOR_CLASSES[department] || ''
}
