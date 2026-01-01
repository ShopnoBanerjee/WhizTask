'use client'

import { useState, useEffect } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { TimeLogger } from './time-logger'
import { TaskPanel } from './task-panel'
import { TimeStats } from './time-stats'
import { TimeEntryForm } from './time-entry-form'
import { getTimeLogs } from '@/lib/employee/actions'
import type { TaskWithRelations, TimeLogWithTask, TimeBlock } from '@/types/database'

interface TimeLoggerWrapperProps {
  tasks: TaskWithRelations[]
  initialLogs: TimeLogWithTask[]
  initialDate: string
}

export function TimeLoggerWrapper({ tasks, initialLogs, initialDate }: TimeLoggerWrapperProps) {
  const [selectedDate, setSelectedDate] = useState(new Date(initialDate))
  const [blocks, setBlocks] = useState<TimeBlock[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [logs, setLogs] = useState<TimeLogWithTask[]>(initialLogs)
  const [refreshKey, setRefreshKey] = useState(0)

  const dateString = format(selectedDate, 'yyyy-MM-dd')
  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  // Fetch logs when date changes
  useEffect(() => {
    const fetchLogs = async () => {
      const newLogs = await getTimeLogs(dateString)
      setLogs(newLogs)
      setRefreshKey(prev => prev + 1)
    }
    
    if (dateString !== format(new Date(initialDate), 'yyyy-MM-dd')) {
      fetchLogs()
    }
  }, [dateString, initialDate])

  const handlePrevDay = () => {
    setSelectedDate(prev => subDays(prev, 1))
    setSelectedTaskId(null)
  }

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1))
    setSelectedTaskId(null)
  }

  const handleToday = () => {
    setSelectedDate(new Date())
    setSelectedTaskId(null)
  }

  const handleEntryAdded = () => {
    // Refresh logs after adding via form
    getTimeLogs(dateString).then(newLogs => {
      setLogs(newLogs)
      setRefreshKey(prev => prev + 1)
    })
  }

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevDay}>
            <ChevronLeft className="size-4" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-44">
                <CalendarIcon className="mr-2 size-4" />
                {format(selectedDate, 'EEE, MMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date)
                    setSelectedTaskId(null)
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          <Button variant="outline" size="icon" onClick={handleNextDay}>
            <ChevronRight className="size-4" />
          </Button>

          {!isToday && (
            <Button variant="ghost" size="sm" onClick={handleToday}>
              Today
            </Button>
          )}
        </div>
      </div>

      {/* Task selection row */}
      <TaskPanel 
        tasks={tasks} 
        selectedTaskId={selectedTaskId}
        onTaskSelect={setSelectedTaskId}
      />

      {/* Timeline */}
      <TimeLogger
        key={refreshKey}
        date={dateString}
        tasks={tasks}
        initialLogs={logs}
        onBlocksChange={setBlocks}
        draggingTaskId={selectedTaskId}
      />

      {/* Form + Stats row */}
      <div className="grid gap-4 md:grid-cols-2">
        <TimeEntryForm 
          date={dateString}
          tasks={tasks}
          blocks={blocks}
          onEntryAdded={handleEntryAdded}
        />
        <TimeStats blocks={blocks} />
      </div>
    </div>
  )
}
