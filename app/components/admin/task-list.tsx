'use client'

import { useState } from 'react'
import { format, isToday, isPast } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CalendarIcon, MoreVertical, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateTaskStatus, deleteTask } from '@/lib/admin/actions'
import {
  DEPARTMENTS,
  TASK_STATUSES,
  type TaskWithRelations,
  type Department,
  type TaskStatus,
} from '@/types/database'

interface TaskListProps {
  initialTasks: TaskWithRelations[]
}

export function TaskList({ initialTasks }: TaskListProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [filterDate, setFilterDate] = useState<Date | undefined>(new Date())
  const [filterDepartment, setFilterDepartment] = useState<Department | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all')

  const filteredTasks = tasks.filter((task) => {
    // Date filter
    if (filterDate) {
      const taskDate = new Date(task.deadline)
      if (
        taskDate.getDate() !== filterDate.getDate() ||
        taskDate.getMonth() !== filterDate.getMonth() ||
        taskDate.getFullYear() !== filterDate.getFullYear()
      ) {
        return false
      }
    }

    // Department filter
    if (filterDepartment !== 'all' && task.department !== filterDepartment) {
      return false
    }

    // Status filter
    if (filterStatus !== 'all' && task.status !== filterStatus) {
      return false
    }

    return true
  })

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    await updateTaskStatus(taskId, status)
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    )
  }

  async function handleDelete(taskId: string) {
    await deleteTask(taskId)
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  function getStatusColor(status: TaskStatus) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      default:
        return ''
    }
  }

  function getDepartmentLabel(dept: Department) {
    return DEPARTMENTS.find((d) => d.value === dept)?.label || dept
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-50 justify-start">
              <CalendarIcon className="mr-2 size-4" />
              {filterDate ? format(filterDate, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={filterDate}
              onSelect={setFilterDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Select
          value={filterDepartment}
          onValueChange={(v) => setFilterDepartment(v as Department | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {DEPARTMENTS.map((dept) => (
              <SelectItem key={dept.value} value={dept.value}>
                {dept.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v as TaskStatus | 'all')}
        >
          <SelectTrigger className="w-37.5">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {TASK_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          onClick={() => {
            setFilterDate(new Date())
            setFilterDepartment('all')
            setFilterStatus('all')
          }}
        >
          Reset
        </Button>
      </div>

      {/* Task count */}
      <p className="text-sm text-muted-foreground">
        {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} found
      </p>

      {/* Task grid */}
      <ScrollArea className="h-[calc(100vh-300px)]">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => (
            <Card key={task.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{task.client.name}</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(task.id, 'in_progress')}
                      >
                        Mark In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(task.id, 'completed')}
                      >
                        Mark Completed
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(task.id)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {getDepartmentLabel(task.department)}
                  </Badge>
                  <Badge className={cn('capitalize', getStatusColor(task.status))}>
                    {task.status.replace('_', ' ')}
                  </Badge>
                </div>

                {task.details && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {task.details}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span
                    className={cn(
                      'text-muted-foreground',
                      isPast(new Date(task.deadline)) &&
                        task.status !== 'completed' &&
                        'text-red-600'
                    )}
                  >
                    {format(new Date(task.deadline), 'MMM d, yyyy')}
                  </span>

                  {task.attachments.length > 0 && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Paperclip className="size-3" />
                      {task.attachments.length}
                    </span>
                  )}
                </div>

                {task.assigned_employee && (
                  <p className="text-xs text-muted-foreground">
                    Assigned to: {task.assigned_employee.email}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}

          {filteredTasks.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              No tasks found for the selected filters
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
