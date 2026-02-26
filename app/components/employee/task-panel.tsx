'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Clock, Check, ChevronRight } from 'lucide-react'
import { format, isPast } from 'date-fns'
import { cn } from '@/lib/utils'
import type { TaskWithRelations, SubtaskWithRelations } from '@/types/database'
import { DEPARTMENTS, TASK_STATUSES } from '@/types/database'
import { getStatusColor, getDepartmentColor } from '@/lib/taskColors'

interface TaskPanelProps {
  tasks: TaskWithRelations[]
  selectedTaskId?: string | null
  selectedSubtaskId?: string | null
  currentUserId: string
  onTaskSelect?: (taskId: string | null, subtaskId?: string | null) => void
}

const TASK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

interface SelectableItem {
  type: 'task' | 'subtask'
  taskId: string
  subtaskId?: string
  title: string
  clientName: string
  deadline: string
  status: string
  color: string
  isOverdue: boolean
}

export function TaskPanel({ tasks, selectedTaskId, selectedSubtaskId, currentUserId, onTaskSelect }: TaskPanelProps) {
  // status colors are pulled from shared helpers

  // Build selectable items from tasks and their subtasks
  const selectableItems: SelectableItem[] = []
  let colorIndex = 0
  
  tasks.forEach(task => {
    const hasSubtasks = task.subtasks && task.subtasks.length > 0
    const mySubtasks = task.subtasks?.filter(s => s.assigned_to === currentUserId) || []
    const color = TASK_COLORS[colorIndex % TASK_COLORS.length]
    colorIndex++
    
    // If task is directly assigned to user and has no subtasks, show it
    if (task.assigned_to === currentUserId && !hasSubtasks) {
      const isOverdue = isPast(new Date(task.deadline)) && task.status !== 'completed'
      selectableItems.push({
        type: 'task',
        taskId: task.id,
        title: task.details?.substring(0, 40) || 'Task',
        clientName: task.client?.name || 'Unknown',
        deadline: task.deadline,
        status: task.status,
        color,
        isOverdue
      })
    }
    
    // Add subtasks assigned to user
    mySubtasks.forEach(subtask => {
      const isOverdue = isPast(new Date(subtask.deadline)) && subtask.status !== 'completed'
      selectableItems.push({
        type: 'subtask',
        taskId: task.id,
        subtaskId: subtask.id,
        title: subtask.title,
        clientName: task.client?.name || 'Unknown',
        deadline: subtask.deadline,
        status: subtask.status,
        color,
        isOverdue
      })
    })
  })

  const handleItemClick = (item: SelectableItem) => {
    if (!onTaskSelect) return
    
    const isCurrentlySelected = 
      (item.type === 'task' && selectedTaskId === item.taskId && !selectedSubtaskId) ||
      (item.type === 'subtask' && selectedSubtaskId === item.subtaskId)
    
    if (isCurrentlySelected) {
      onTaskSelect(null, null)
    } else {
      onTaskSelect(item.taskId, item.subtaskId || null)
    }
  }

  if (selectableItems.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No active tasks assigned to you
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2 ">
        <CardTitle className="text-base flex items-center gap-2">
          Tasks
          <Badge variant="secondary" className="text-xs">{selectableItems.length}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {selectedTaskId || selectedSubtaskId 
            ? 'Click timeline to place • Click again to deselect' 
            : 'Select a task/subtask, then click on timeline'}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-36">
          <div className="space-y-1 p-3 pt-0">
            {selectableItems.map(item => {
              const isSelected = 
                (item.type === 'task' && selectedTaskId === item.taskId && !selectedSubtaskId) ||
                (item.type === 'subtask' && selectedSubtaskId === item.subtaskId)

              return (
                <div
                  key={item.subtaskId || item.taskId}
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
                    'border-2',
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-transparent hover:bg-muted/50',
                    item.isOverdue && !isSelected && 'border-destructive/30'
                  )}
                >
                  <div 
                    className="size-3 rounded shrink-0" 
                    style={{ backgroundColor: item.color }}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {item.type === 'subtask' && (
                        <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">
                        {item.title}
                      </span>
                      {isSelected && (
                        <Check className="size-3 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.clientName}
                    </p>
                  </div>
                  
                  <div className={cn(
                    'text-xs shrink-0',
                    item.isOverdue ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    {format(new Date(item.deadline), 'MMM d')}
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
