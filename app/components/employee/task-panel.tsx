'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Clock, Check } from 'lucide-react'
import { format, isPast } from 'date-fns'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/types/database'
import { DEPARTMENTS, TASK_STATUSES } from '@/types/database'

interface TaskPanelProps {
  tasks: TaskWithRelations[]
  selectedTaskId?: string | null
  onTaskSelect?: (taskId: string | null) => void
}

const TASK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

export function TaskPanel({ tasks, selectedTaskId, onTaskSelect }: TaskPanelProps) {
  const getStatusColor = (status: string) => {
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

  const handleTaskClick = (taskId: string) => {
    if (onTaskSelect) {
      onTaskSelect(selectedTaskId === taskId ? null : taskId)
    }
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No active tasks
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          Tasks
          <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {selectedTaskId ? 'Click timeline to place • Click again to deselect' : 'Select a task, then click on timeline'}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-48">
          <div className="space-y-1 p-3 pt-0">
            {tasks.map((task, index) => {
              const isOverdue = isPast(new Date(task.deadline)) && task.status !== 'completed'
              const color = TASK_COLORS[index % TASK_COLORS.length]
              const isSelected = selectedTaskId === task.id

              return (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task.id)}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
                    'border-2',
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-transparent hover:bg-muted/50',
                    isOverdue && !isSelected && 'border-destructive/30'
                  )}
                >
                  <div 
                    className="size-3 rounded shrink-0" 
                    style={{ backgroundColor: color }}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium truncate">
                        {task.client?.name || 'Unknown'}
                      </span>
                      {isSelected && (
                        <Check className="size-3 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {task.details || 'No details'}
                    </p>
                  </div>
                  
                  <div className={cn(
                    'text-xs shrink-0',
                    isOverdue ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    {format(new Date(task.deadline), 'MMM d')}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
