'use client'

import { useState } from 'react'
import { format, isPast } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CalendarIcon, MoreVertical, Clock, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateEmployeeTaskStatus } from '@/lib/employee/actions'
import { 
  DEPARTMENTS, 
  TASK_STATUSES,
  type TaskWithRelations, 
  type TaskStatus 
} from '@/types/database'

interface EmployeeTaskListProps {
  initialTasks: TaskWithRelations[]
}

export function EmployeeTaskList({ initialTasks }: EmployeeTaskListProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all')
  const [filterDate, setFilterDate] = useState<Date | undefined>()

  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false
    
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
    
    return true
  })

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    const result = await updateEmployeeTaskStatus(taskId, status)
    if (result.success) {
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status } : t
      ))
    }
  }

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'overdue': return 'bg-red-100 text-red-800'
      default: return ''
    }
  }

  const getDepartmentLabel = (dept: string) => {
    return DEPARTMENTS.find(d => d.value === dept)?.label || dept
  }

  const getStatusLabel = (status: string) => {
    return TASK_STATUSES.find(s => s.value === status)?.label || status
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select 
          value={filterStatus} 
          onValueChange={(v) => setFilterStatus(v as TaskStatus | 'all')}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {TASK_STATUSES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 size-4" />
              {filterDate ? format(filterDate, 'PPP') : 'Filter by date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filterDate}
              onSelect={setFilterDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {(filterStatus !== 'all' || filterDate) && (
          <Button 
            variant="ghost" 
            onClick={() => {
              setFilterStatus('all')
              setFilterDate(undefined)
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tasks found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map(task => {
            const isOverdue = isPast(new Date(task.deadline)) && task.status !== 'completed'
            
            return (
              <Card key={task.id} className={cn(isOverdue && 'border-destructive/50')}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {task.client?.name || 'Unknown Client'}
                    </CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {TASK_STATUSES.filter(s => s.value !== task.status).map(s => (
                          <DropdownMenuItem 
                            key={s.value}
                            onClick={() => handleStatusChange(task.id, s.value)}
                          >
                            Mark as {s.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      {getDepartmentLabel(task.department)}
                    </Badge>
                    <Badge className={cn('text-xs', getStatusColor(task.status))}>
                      {getStatusLabel(task.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {task.details || 'No details provided'}
                  </p>
                  
                  <div className={cn(
                    'flex items-center gap-1 text-sm',
                    isOverdue ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    <Clock className="size-4" />
                    <span>
                      {isOverdue ? 'Overdue: ' : 'Due: '}
                      {format(new Date(task.deadline), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>

                  {task.attachments && task.attachments.length > 0 && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Paperclip className="size-4" />
                      <span>{task.attachments.length} attachment(s)</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
