'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TimeBlock } from '@/types/database'

interface TimeStatsProps {
  blocks: TimeBlock[]
}

export function TimeStats({ blocks }: TimeStatsProps) {
  const stats = useMemo(() => {
    const taskMap = new Map<string, {
      taskName: string
      clientName: string
      totalMinutes: number
      color: string
    }>()

    blocks.forEach(block => {
      const duration = block.endTime - block.startTime
      if (!taskMap.has(block.taskId)) {
        taskMap.set(block.taskId, {
          taskName: block.taskName,
          clientName: block.clientName,
          totalMinutes: 0,
          color: block.color,
        })
      }
      const entry = taskMap.get(block.taskId)!
      entry.totalMinutes += duration
    })

    const totalLogged = blocks.reduce((sum, b) => sum + (b.endTime - b.startTime), 0)
    const remaining = 1440 - totalLogged // 24 hours = 1440 minutes

    return {
      totalLogged,
      remaining: Math.max(0, remaining),
      taskBreakdown: Array.from(taskMap.entries()).map(([taskId, data]) => ({
        taskId,
        ...data,
      })),
    }
  }, [blocks])

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }

  const loggedPercentage = (stats.totalLogged / 1440) * 100

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Today&apos;s Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total logged */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Logged</span>
            <span className="font-medium">{formatDuration(stats.totalLogged)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${loggedPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{Math.round(loggedPercentage)}% of day</span>
            <span>{formatDuration(stats.remaining)} remaining</span>
          </div>
        </div>

        {/* Task breakdown */}
        {stats.taskBreakdown.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium">By Task</div>
            <div className="space-y-2">
              {stats.taskBreakdown.map(task => {
                const taskPercentage = (task.totalMinutes / 1440) * 100
                
                return (
                  <div key={task.taskId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span 
                          className="size-2 rounded-full shrink-0" 
                          style={{ backgroundColor: task.color }}
                        />
                        <span className="truncate">{task.clientName}</span>
                      </div>
                      <span className="font-medium shrink-0 ml-2">
                        {formatDuration(task.totalMinutes)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${taskPercentage}%`,
                          backgroundColor: task.color
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {task.taskName}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {stats.taskBreakdown.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No time logged yet. Drag tasks onto the timeline to start.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
