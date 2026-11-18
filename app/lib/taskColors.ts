import { TaskStatus, Department } from '@/types/database'

// Badge colours for a dark UI: a translucent tint of the hue with light text.
// (The old bg-*-100 / text-*-800 pairs were made for a white page.)

// Central color classes for task statuses
export const STATUS_COLOR_CLASSES: Record<TaskStatus, string> = {
  pending: 'bg-yellow-500/15 text-yellow-300',
  in_progress: 'bg-blue-500/15 text-blue-300',
  completed: 'bg-green-500/15 text-green-300',
  overdue: 'bg-red-500/15 text-red-300',
}

// Assign each department a unique color combination (background + text)
export const DEPARTMENT_COLOR_CLASSES: Record<Department, string> = {
  planning:        'bg-purple-500/15 text-purple-300',
  client_servicing:'bg-indigo-500/15 text-indigo-300',
  design:          'bg-pink-500/15 text-pink-300',
  content:         'bg-emerald-500/15 text-emerald-300',
  editing:         'bg-amber-500/15 text-amber-300',
  shooting:        'bg-orange-500/15 text-orange-300',
  seo:             'bg-teal-500/15 text-teal-300',
  web_design:      'bg-sky-500/15 text-sky-300',
  posting_reporting:'bg-fuchsia-500/15 text-fuchsia-300',
  online_ads:      'bg-rose-500/15 text-rose-300',
}

export function getStatusColor(status: TaskStatus) {
  return STATUS_COLOR_CLASSES[status] || ''
}

export function getDepartmentColor(department: Department) {
  return DEPARTMENT_COLOR_CLASSES[department] || ''
}
