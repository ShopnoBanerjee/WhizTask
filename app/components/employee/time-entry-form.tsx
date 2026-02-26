'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus } from 'lucide-react'
import { createTimeLog } from '@/lib/employee/actions'
import type { TaskWithRelations, TimeBlock, SubtaskWithRelations } from '@/types/database'

interface TimeEntryFormProps {
  date: string
  tasks: TaskWithRelations[]
  blocks: TimeBlock[]
  currentUserId: string
  onEntryAdded?: () => void
}

// Generate time options in 30-min intervals
const TIME_OPTIONS = Array.from({ length: 49 }, (_, i) => {
  const minutes = i * 30
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return {
    value: minutes,
    label: `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`,
  }
})

interface TaskOption {
  type: 'task' | 'subtask'
  taskId: string
  subtaskId?: string
  label: string
  clientName: string
}

export function TimeEntryForm({ date, tasks, blocks, currentUserId, onEntryAdded }: TimeEntryFormProps) {
  const [selectedOption, setSelectedOption] = useState<string>('')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [endTime, setEndTime] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Build a flat list of task/subtask options
  const taskOptions = useMemo(() => {
    const options: TaskOption[] = []
    
    tasks.forEach(task => {
      const hasSubtasks = task.subtasks && task.subtasks.length > 0
      const mySubtasks = task.subtasks?.filter(s => s.assigned_to === currentUserId) || []
      
      // If task is directly assigned to user and has no subtasks, show it as a direct option
      if (task.assigned_to === currentUserId && !hasSubtasks) {
        options.push({
          type: 'task',
          taskId: task.id,
          label: task.details?.substring(0, 40) || 'Task',
          clientName: task.client?.name || 'Unknown Client',
        })
      }
      
      // Add subtasks assigned to user
      mySubtasks.forEach(subtask => {
        options.push({
          type: 'subtask',
          taskId: task.id,
          subtaskId: subtask.id,
          label: subtask.title,
          clientName: task.client?.name || 'Unknown Client',
        })
      })
    })
    
    return options
  }, [tasks, currentUserId])

  const checkOverlap = (start: number, end: number): boolean => {
    return blocks.some(block => start < block.endTime && end > block.startTime)
  }

  const parseSelectedOption = (value: string): { taskId: string; subtaskId?: string } | null => {
    if (!value) return null
    const parts = value.split(':')
    if (parts.length === 2 && parts[0] === 'task') {
      return { taskId: parts[1] }
    } else if (parts.length === 3 && parts[0] === 'subtask') {
      return { taskId: parts[1], subtaskId: parts[2] }
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsed = parseSelectedOption(selectedOption)
    if (!parsed || startTime === null || endTime === null) {
      setError('Please fill all fields')
      return
    }

    if (endTime <= startTime) {
      setError('End time must be after start time')
      return
    }

    if (checkOverlap(startTime, endTime)) {
      setError('Time overlaps with existing entry')
      return
    }

    setIsSubmitting(true)
    const result = await createTimeLog({
      taskId: parsed.taskId,
      subtaskId: parsed.subtaskId || null,
      logDate: date,
      startTime,
      endTime,
    })
    setIsSubmitting(false)

    if (result.error) {
      setError(result.error)
    } else {
      // Reset form
      setSelectedOption('')
      setStartTime(null)
      setEndTime(null)
      onEntryAdded?.()
    }
  }

  // Filter end time options to be after start time
  const endTimeOptions = startTime !== null 
    ? TIME_OPTIONS.filter(t => t.value > startTime)
    : TIME_OPTIONS

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Quick Add</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Task / Subtask</Label>
            <Select value={selectedOption} onValueChange={setSelectedOption}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select task or subtask" />
              </SelectTrigger>
              <SelectContent>
                {taskOptions.map(opt => {
                  const key = opt.type === 'task' 
                    ? `task:${opt.taskId}` 
                    : `subtask:${opt.taskId}:${opt.subtaskId}`
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col items-start">
                        <span className="truncate text-sm">
                          {opt.type === 'subtask' && '↳ '}{opt.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {opt.clientName}
                        </span>
                      </div>
                    </SelectItem>
                  )
                })}
                {taskOptions.length === 0 && (
                  <SelectItem value="none" disabled>
                    No tasks assigned to you
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Start</Label>
              <Select 
                value={startTime?.toString() ?? ''} 
                onValueChange={(v) => setStartTime(parseInt(v))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Start" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.slice(0, -1).map(t => (
                    <SelectItem key={t.value} value={t.value.toString()}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">End</Label>
              <Select 
                value={endTime?.toString() ?? ''} 
                onValueChange={(v) => setEndTime(parseInt(v))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="End" />
                </SelectTrigger>
                <SelectContent>
                  {endTimeOptions.slice(1).map(t => (
                    <SelectItem key={t.value} value={t.value.toString()}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <Button 
            type="submit" 
            size="sm" 
            className="w-full"
            disabled={isSubmitting || !selectedOption || startTime === null || endTime === null}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Plus className="size-4 mr-1" />
                Add Entry
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
