'use client'

import { useState, useEffect } from 'react'
import { format, isPast } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { CalendarIcon, MoreVertical, Paperclip, User, ChevronDown, ListTodo, Edit, Trash2, CheckCircle2, Clock, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateTaskStatus, deleteTask, updateSubtaskStatus, deleteSubtask } from '@/lib/admin/actions'
import { EditTaskForm } from './edit-task-form'
import {
  DEPARTMENTS,
  type TaskWithRelations,
  type Department,
  type TaskStatus,
  type SubtaskWithRelations,
} from '@/types/database'
import { getStatusColor, getDepartmentColor } from '@/lib/taskColors'

interface TaskListProps {
  tasks: TaskWithRelations[]
}

export function TaskList({ tasks: initialTasks }: TaskListProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])



  function toggleExpanded(taskId: string) {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    await updateTaskStatus(taskId, status)
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    )
  }

  async function handleSubtaskStatusChange(taskId: string, subtaskId: string, status: TaskStatus) {
    await updateSubtaskStatus(subtaskId, status)
    // Update local state
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId && t.subtasks) {
          const updatedSubtasks = t.subtasks.map(st => 
            st.id === subtaskId ? { ...st, status } : st
          )
          // Derive parent task status
          const allCompleted = updatedSubtasks.every(st => st.status === 'completed')
          const anyInProgress = updatedSubtasks.some(st => st.status === 'in_progress')
          let newTaskStatus: TaskStatus = 'pending'
          if (allCompleted) newTaskStatus = 'completed'
          else if (anyInProgress) newTaskStatus = 'in_progress'
          
          return { ...t, subtasks: updatedSubtasks, status: newTaskStatus }
        }
        return t
      })
    )
  }

  async function handleDelete(taskId: string) {
    await deleteTask(taskId)
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  async function handleSubtaskDelete(taskId: string, subtaskId: string) {
    await deleteSubtask(subtaskId)
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId && t.subtasks) {
          return { ...t, subtasks: t.subtasks.filter(st => st.id !== subtaskId) }
        }
        return t
      })
    )
  }

  function handleTaskUpdated(updatedTask: TaskWithRelations) {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    )
    setEditingTask(null)
  }

  // status/dept colors are handled by shared helpers

  function getStatusIcon(status: TaskStatus) {
    switch (status) {
      case 'pending':
        return <Circle className="size-3.5" />
      case 'in_progress':
        return <Clock className="size-3.5" />
      case 'completed':
        return <CheckCircle2 className="size-3.5" />
      case 'overdue':
        return <Circle className="size-3.5 text-red-500" />
      default:
        return null
    }
  }

  function getDepartmentLabel(dept: Department) {
    return DEPARTMENTS.find((d) => d.value === dept)?.label || dept
  }

  function getSubtaskProgress(subtasks: SubtaskWithRelations[]): { completed: number; total: number; percentage: number } {
    const total = subtasks.length
    const completed = subtasks.filter(st => st.status === 'completed').length
    const percentage = total > 0 ? (completed / total) * 100 : 0
    return { completed, total, percentage }
  }

  const hasSubtasks = (task: TaskWithRelations) => task.subtasks && task.subtasks.length > 0

  return (
    <div className="space-y-4">

      {/* Task count */}
      <p className="text-sm text-muted-foreground">
        {tasks.length} task{tasks.length !== 1 ? 's' : ''} found
      </p>

      {/* Task grid */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {tasks.map((task) => {
            const subtaskProgress = hasSubtasks(task) ? getSubtaskProgress(task.subtasks!) : null
            const isExpanded = expandedTasks.has(task.id)

            return (
              <Card key={task.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{task.client.name}</CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingTask(task)}>
                          <Edit className="mr-2 size-4" />
                          Edit Task
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {!hasSubtasks(task) && (
                          <>
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
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(task.id)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cn('capitalize', getStatusColor(task.status))}>
                        {task.status.replace('_', ' ')}
                      </Badge>
                      <Badge className={getDepartmentColor(task.department)}>
                        {getDepartmentLabel(task.department)}
                      </Badge>
                      {hasSubtasks(task) && (
                        <Badge variant="secondary" className="gap-1">
                          <ListTodo className="size-3" />
                          {subtaskProgress?.completed}/{subtaskProgress?.total}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarIcon className="size-4" />
                      <span
                        className={cn(
                          isPast(new Date(task.deadline)) &&
                            task.status !== 'completed' &&
                            'text-red-600 font-medium'
                        )}
                      >
                        {format(new Date(task.deadline), 'MMM d, yyyy')}
                      </span>
                    </div>

                    {/* Show assigned employee for single-assignee tasks */}
                    {!hasSubtasks(task) && task.assigned_employee && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="size-4" />
                        <span>{task.assigned_employee.name || task.assigned_employee.email}</span>
                      </div>
                    )}

                    {task.details && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {task.details}
                      </p>
                    )}

                    {task.attachments.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Paperclip className="size-4" />
                        <span>{task.attachments.length} attachment{task.attachments.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}

                    {/* Subtasks Section */}
                    {hasSubtasks(task) && (
                      <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(task.id)}>
                        <div className="space-y-2 pt-2 border-t">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full justify-between p-2 h-auto">
                              <div className="flex items-center gap-2">
                                <ListTodo className="size-4" />
                                <span className="text-sm font-medium">Subtasks</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {subtaskProgress?.completed}/{subtaskProgress?.total} completed
                                </span>
                                <ChevronDown className={cn("size-4 transition-transform", isExpanded && "rotate-180")} />
                              </div>
                            </Button>
                          </CollapsibleTrigger>
                          
                          <Progress value={subtaskProgress?.percentage} className="h-1.5" />
                          
                          <CollapsibleContent className="space-y-2">
                            {task.subtasks!.map((subtask) => (
                              <div 
                                key={subtask.id} 
                                className={cn(
                                  "flex items-start justify-between p-2 rounded-md border text-sm",
                                  subtask.status === 'completed' && "bg-muted/50"
                                )}
                              >
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(subtask.status)}
                                    <span className={cn(
                                      "font-medium truncate",
                                      subtask.status === 'completed' && "line-through text-muted-foreground"
                                    )}>
                                      {subtask.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <User className="size-3" />
                                    <span>{subtask.assigned_employee?.name || subtask.assigned_employee?.email || 'Unassigned'}</span>
                                    <span>•</span>
                                    <span className={cn(
                                      isPast(new Date(subtask.deadline)) && subtask.status !== 'completed' && "text-red-600"
                                    )}>
                                      {format(new Date(subtask.deadline), 'MMM d')}
                                    </span>
                                  </div>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                      <MoreVertical className="size-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => handleSubtaskStatusChange(task.id, subtask.id, 'pending')}
                                    >
                                      Mark Pending
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleSubtaskStatusChange(task.id, subtask.id, 'in_progress')}
                                    >
                                      Mark In Progress
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleSubtaskStatusChange(task.id, subtask.id, 'completed')}
                                    >
                                      Mark Completed
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => handleSubtaskDelete(task.id, subtask.id)}
                                    >
                                      Delete Subtask
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            ))}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {tasks.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              No tasks found for the selected filters
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Edit Task Dialog */}
      {editingTask && (
        <EditTaskForm
          task={editingTask}
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          onTaskUpdated={handleTaskUpdated}
        />
      )}
    </div>
  )
}
