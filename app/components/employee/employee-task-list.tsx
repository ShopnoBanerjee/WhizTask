'use client'

import { useState, useEffect } from 'react'
import { format, isPast } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { 
  MoreVertical, 
  Clock, 
  Paperclip, 
  ChevronDown, 
  ChevronRight,
  User,
  CheckCircle2,
  Circle,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateEmployeeTaskStatus, updateEmployeeSubtaskStatus, getEmployeeClients, getEmployeeTasks } from '@/lib/employee/actions'
import { 
  DEPARTMENTS, 
  TASK_STATUSES,
  type TaskWithRelations, 
  type TaskStatus,
  type SubtaskWithRelations,
  type Client
} from '@/types/database'
import { getStatusColor, getDepartmentColor } from '@/lib/taskColors'

interface EmployeeTaskListProps {
  initialTasks: TaskWithRelations[]
  currentUserId: string
}

export function EmployeeTaskList({ initialTasks, currentUserId }: EmployeeTaskListProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all')
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')
  const [filterClient, setFilterClient] = useState('all')
  const [clients, setClients] = useState<Client[]>([])
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  // when filters change, fetch from server
  const loadTasks = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (filterStatus !== 'all') params.status = filterStatus
      if (filterClient !== 'all') params.clientId = filterClient
      if (filterStart && filterEnd) {
        params.startDate = filterStart
        params.endDate = filterEnd
      } else if (filterStart && !filterEnd) {
        params.startDate = filterStart
        params.endDate = new Date().toISOString()
      }
      const result = await getEmployeeTasks(params)
      setTasks(result)
    } catch (err) {
      console.error('Error loading employee tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [filterStatus, filterClient, filterStart, filterEnd])

  const filteredTasks = tasks

  const toggleExpanded = (taskId: string) => {
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

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    const result = await updateEmployeeTaskStatus(taskId, status)
    if (result.success) {
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status } : t
      ))
    }
  }

  const handleSubtaskStatusChange = async (subtaskId: string, taskId: string, status: TaskStatus) => {
    const result = await updateEmployeeSubtaskStatus(subtaskId, status)
    if (result.success) {
      // Update local state
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t
        const updatedSubtasks = t.subtasks?.map(s => 
          s.id === subtaskId ? { ...s, status } : s
        )
        // Derive parent status
        let parentStatus: TaskStatus = 'pending'
        if (updatedSubtasks && updatedSubtasks.length > 0) {
          const allCompleted = updatedSubtasks.every(s => s.status === 'completed')
          const anyInProgress = updatedSubtasks.some(s => s.status === 'in_progress')
          const anyCompleted = updatedSubtasks.some(s => s.status === 'completed')
          
          if (allCompleted) {
            parentStatus = 'completed'
          } else if (anyInProgress || anyCompleted) {
            parentStatus = 'in_progress'
          }
        }
        return { ...t, subtasks: updatedSubtasks, status: parentStatus }
      }))
    }
  }

  // status colors come from shared helpers

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="size-4 text-green-600" />
      case 'in_progress': return <Loader2 className="size-4 text-blue-600" />
      default: return <Circle className="size-4 text-gray-400" />
    }
  }

  const getDepartmentLabel = (dept: string) => {
    return DEPARTMENTS.find(d => d.value === dept)?.label || dept
  }

  const getStatusLabel = (status: string) => {
    return TASK_STATUSES.find(s => s.value === status)?.label || status
  }

  // fetch client list for filter
  useEffect(() => {
    getEmployeeClients().then(setClients).catch(console.error)
  }, [])

  // auto-set end date when start date selected without end
  useEffect(() => {
    if (filterStart && !filterEnd) {
      setFilterEnd(new Date().toISOString().split('T')[0])
    }
  }, [filterStart])

  // Get subtasks assigned to current user
  const getMySubtasks = (subtasks?: SubtaskWithRelations[]) => {
    if (!subtasks) return []
    return subtasks.filter(s => s.assigned_to === currentUserId)
  }

  // Check if user is directly assigned to the task (not just via subtask)
  const isDirectlyAssigned = (task: TaskWithRelations) => {
    return task.assigned_to === currentUserId
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="space-y-1">
          <Label>Status</Label>
          <Select 
            value={filterStatus} 
            onValueChange={(v) => setFilterStatus(v as TaskStatus | 'all')}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {TASK_STATUSES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Start Date</Label>
          <Input
            type="date"
            className="w-48"
            value={filterStart}
            onChange={e => setFilterStart(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>End Date</Label>
          <Input
            type="date"
            className="w-48"
            value={filterEnd}
            onChange={e => setFilterEnd(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Client</Label>
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {loading && (
          <div className="self-end">
            <Loader2 className="animate-spin size-5 text-muted-foreground" />
          </div>
        )}
        {(filterStatus !== 'all' || filterStart || filterEnd || filterClient !== 'all') && (
          <div className="self-end">
            <Button 
              variant="ghost" 
              onClick={() => {
                setFilterStatus('all')
                setFilterStart('')
                setFilterEnd('')
                setFilterClient('all')
              }}
            >
              Clear Filters
            </Button>
          </div>
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
            const hasSubtasks = task.subtasks && task.subtasks.length > 0
            const mySubtasks = getMySubtasks(task.subtasks)
            const isExpanded = expandedTasks.has(task.id)
            const directlyAssigned = isDirectlyAssigned(task)
            
            // Calculate subtask progress
            const completedSubtasks = mySubtasks.filter(s => s.status === 'completed').length
            const progress = mySubtasks.length > 0 
              ? (completedSubtasks / mySubtasks.length) * 100 
              : 0

            return (
              <Card key={task.id} className={cn(isOverdue && 'border-destructive/50')}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {task.client?.name || 'Unknown Client'}
                    </CardTitle>
                    {/* Only show status dropdown if directly assigned and no subtasks */}
                    {directlyAssigned && !hasSubtasks && (
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
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={cn('text-xs', getDepartmentColor(task.department))}>
                      {getDepartmentLabel(task.department)}
                    </Badge>
                    <Badge className={cn('text-xs', getStatusColor(task.status))}>
                      {getStatusLabel(task.status)}
                    </Badge>
                    {hasSubtasks && mySubtasks.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {mySubtasks.length} assigned to you
                      </Badge>
                    )}
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

                  {/* Subtasks section */}
                  {mySubtasks.length > 0 && (
                    <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(task.id)}>
                      <div className="mt-3 border-t pt-3">
                        <CollapsibleTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full justify-between px-2 h-8"
                          >
                            <span className="flex items-center gap-2 text-xs font-medium">
                              {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                              Your Subtasks ({completedSubtasks}/{mySubtasks.length})
                            </span>
                            <Progress value={progress} className="w-16 h-1.5" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 space-y-2">
                          {mySubtasks.map(subtask => {
                            const subtaskOverdue = isPast(new Date(subtask.deadline)) && subtask.status !== 'completed'
                            return (
                              <div 
                                key={subtask.id} 
                                className={cn(
                                  "rounded-md border p-2 text-xs",
                                  subtask.assigned_to === currentUserId && "bg-primary/5 border-primary/20"
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2 flex-1">
                                    {getStatusIcon(subtask.status)}
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium truncate">{subtask.title}</p>
                                      {subtask.details && (
                                        <p className="text-muted-foreground mt-0.5 line-clamp-2">
                                          {subtask.details}
                                        </p>
                                      )}
                                      <div className={cn(
                                        "flex items-center gap-1 mt-1",
                                        subtaskOverdue ? "text-destructive" : "text-muted-foreground"
                                      )}>
                                        <Clock className="size-3" />
                                        <span>
                                          {subtaskOverdue ? 'Overdue: ' : ''}
                                          {format(new Date(subtask.deadline), 'MMM d, h:mm a')}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="size-6 shrink-0">
                                        <MoreVertical className="size-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {TASK_STATUSES.filter(s => s.value !== subtask.status).map(s => (
                                        <DropdownMenuItem 
                                          key={s.value}
                                          onClick={() => handleSubtaskStatusChange(subtask.id, task.id, s.value)}
                                        >
                                          Mark as {s.label}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            )
                          })}
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
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
