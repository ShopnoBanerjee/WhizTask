'use client'

import { useState } from 'react'
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
import type { TaskWithRelations, TimeBlock } from '@/types/database'

interface TimeEntryFormProps {
  date: string
  tasks: TaskWithRelations[]
  blocks: TimeBlock[]
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

export function TimeEntryForm({ date, tasks, blocks, onEntryAdded }: TimeEntryFormProps) {
  const [selectedTask, setSelectedTask] = useState<string>('')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [endTime, setEndTime] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkOverlap = (start: number, end: number): boolean => {
    return blocks.some(block => start < block.endTime && end > block.startTime)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedTask || startTime === null || endTime === null) {
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
      taskId: selectedTask,
      logDate: date,
      startTime,
      endTime,
    })
    setIsSubmitting(false)

    if (result.error) {
      setError(result.error)
    } else {
      // Reset form
      setSelectedTask('')
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
            <Label className="text-xs">Task</Label>
            <Select value={selectedTask} onValueChange={setSelectedTask}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select task" />
              </SelectTrigger>
              <SelectContent>
                {tasks.map(task => (
                  <SelectItem key={task.id} value={task.id}>
                    <span className="truncate">
                      {task.client?.name} - {task.details?.substring(0, 20) || 'Task'}
                    </span>
                  </SelectItem>
                ))}
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
            disabled={isSubmitting || !selectedTask || startTime === null || endTime === null}
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
