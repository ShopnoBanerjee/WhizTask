'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { X, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TimeBlock, TaskWithRelations, TimeLogWithTask } from '@/types/database'
import { createTimeLog, updateTimeLog, deleteTimeLog } from '@/lib/employee/actions'

const SNAP_INTERVAL = 30 // minutes
const MIN_BLOCK_DURATION = 30 // minimum block duration in minutes
const TIMELINE_HEIGHT = 60
const SAVE_DEBOUNCE_MS = 800 // Wait 800ms after last change before saving

const TASK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

// Fixed hour width in pixels
const HOUR_WIDTH = 60

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

interface PendingChange {
  blockId: string
  startTime: number
  endTime: number
}

interface TimeLoggerProps {
  date: string
  tasks: TaskWithRelations[]
  initialLogs: TimeLogWithTask[]
  onBlocksChange?: (blocks: TimeBlock[]) => void
  draggingTaskId?: string | null
}

function snapToInterval(minutes: number): number {
  return Math.round(minutes / SNAP_INTERVAL) * SNAP_INTERVAL
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

function getTaskColor(taskId: string, taskColorMap: Map<string, string>): string {
  if (!taskColorMap.has(taskId)) {
    const colorIndex = taskColorMap.size % TASK_COLORS.length
    taskColorMap.set(taskId, TASK_COLORS[colorIndex])
  }
  return taskColorMap.get(taskId)!
}

export function TimeLogger({ date, tasks, initialLogs, onBlocksChange, draggingTaskId }: TimeLoggerProps) {
  const minutesToPosition = (minutes: number) => (minutes / 60) * HOUR_WIDTH
  const positionToMinutes = (position: number) => (position / HOUR_WIDTH) * 60

  const [blocks, setBlocks] = useState<TimeBlock[]>(() => {
    const colorMap = new Map<string, string>()
    return initialLogs.map(log => ({
      id: log.id,
      taskId: log.task_id,
      taskName: log.task?.details?.substring(0, 30) || 'Task',
      clientName: log.task?.client?.name || 'Client',
      startTime: log.start_time,
      endTime: log.end_time,
      color: getTaskColor(log.task_id, colorMap),
    }))
  })
  
  const [dragState, setDragState] = useState<{
    blockId: string
    type: 'move' | 'resize-start' | 'resize-end'
    startX: number
    originalStart: number
    originalEnd: number
  } | null>(null)
  
  const [dropPreview, setDropPreview] = useState<{
    startTime: number
    endTime: number
    isValid: boolean
  } | null>(null)
  
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map())
  
  const timelineRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const taskColorMap = useRef(new Map<string, string>())
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize color map from existing blocks
  useEffect(() => {
    blocks.forEach(block => {
      if (!taskColorMap.current.has(block.taskId)) {
        taskColorMap.current.set(block.taskId, block.color)
      }
    })
  }, [])

  useEffect(() => {
    onBlocksChange?.(blocks)
  }, [blocks, onBlocksChange])

  // Debounced save effect - saves pending changes after user stops interacting
  useEffect(() => {
    if (pendingChanges.size === 0) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    setSaveStatus('pending')

    // Set new timeout to save
    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      
      const changesToSave = Array.from(pendingChanges.values())
      let hasError = false

      // Save all pending changes
      for (const change of changesToSave) {
        const result = await updateTimeLog(change.blockId, {
          startTime: change.startTime,
          endTime: change.endTime,
        })
        
        if (result.error) {
          hasError = true
          setError(result.error)
        }
      }

      if (hasError) {
        setSaveStatus('error')
        setTimeout(() => {
          setSaveStatus('idle')
          setError(null)
        }, 2000)
      } else {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 1500)
      }
      
      setPendingChanges(new Map())
    }, SAVE_DEBOUNCE_MS)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [pendingChanges])

  const checkOverlap = useCallback((start: number, end: number, excludeId?: string): boolean => {
    return blocks.some(block => {
      if (excludeId && block.id === excludeId) return false
      return start < block.endTime && end > block.startTime
    })
  }, [blocks])

  const handleDragStart = (
    e: React.MouseEvent,
    blockId: string,
    type: 'move' | 'resize-start' | 'resize-end'
  ) => {
    e.preventDefault()
    const block = blocks.find(b => b.id === blockId)
    if (!block) return

    setDragState({
      blockId,
      type,
      startX: e.clientX,
      originalStart: block.startTime,
      originalEnd: block.endTime,
    })
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState) return

    const deltaX = e.clientX - dragState.startX
    const deltaMinutes = positionToMinutes(deltaX)
    
    const block = blocks.find(b => b.id === dragState.blockId)
    if (!block) return

    let newStart = block.startTime
    let newEnd = block.endTime

    if (dragState.type === 'move') {
      const duration = dragState.originalEnd - dragState.originalStart
      newStart = snapToInterval(dragState.originalStart + deltaMinutes)
      newEnd = newStart + duration
    } else if (dragState.type === 'resize-start') {
      newStart = snapToInterval(dragState.originalStart + deltaMinutes)
      newEnd = dragState.originalEnd
    } else if (dragState.type === 'resize-end') {
      newStart = dragState.originalStart
      newEnd = snapToInterval(dragState.originalEnd + deltaMinutes)
    }

    // Clamp to valid range
    newStart = Math.max(0, Math.min(newStart, 1440 - MIN_BLOCK_DURATION))
    newEnd = Math.max(newStart + MIN_BLOCK_DURATION, Math.min(newEnd, 1440))

    const hasOverlap = checkOverlap(newStart, newEnd, dragState.blockId)

    setBlocks(prev => prev.map(b => 
      b.id === dragState.blockId
        ? { ...b, startTime: newStart, endTime: newEnd }
        : b
    ))

    if (hasOverlap) {
      setError('Overlap detected')
    } else {
      setError(null)
    }
  }, [dragState, blocks, checkOverlap, positionToMinutes])

  // Optimistic update - queue change for debounced save
  const handleMouseUp = useCallback(() => {
    if (!dragState) return

    const block = blocks.find(b => b.id === dragState.blockId)
    if (!block) {
      setDragState(null)
      return
    }

    const hasOverlap = checkOverlap(block.startTime, block.endTime, block.id)

    if (hasOverlap) {
      // Revert to original position
      setBlocks(prev => prev.map(b =>
        b.id === dragState.blockId
          ? { ...b, startTime: dragState.originalStart, endTime: dragState.originalEnd }
          : b
      ))
      setError('Cannot overlap with existing blocks')
      setTimeout(() => setError(null), 2000)
    } else {
      // Only queue for save if position actually changed
      if (block.startTime !== dragState.originalStart || block.endTime !== dragState.originalEnd) {
        setPendingChanges(prev => {
          const updated = new Map(prev)
          updated.set(block.id, {
            blockId: block.id,
            startTime: block.startTime,
            endTime: block.endTime,
          })
          return updated
        })
      }
    }

    setDragState(null)
    setError(null)
  }, [dragState, blocks, checkOverlap])

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragState, handleMouseMove, handleMouseUp])

  // Handle timeline click to show drop preview when dragging from task panel
  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    if (!draggingTaskId || !timelineRef.current) return

    const rect = timelineRef.current.getBoundingClientRect()
    const scrollLeft = scrollContainerRef.current?.scrollLeft || 0
    const x = e.clientX - rect.left + scrollLeft
    const minutes = snapToInterval(positionToMinutes(x))

    const startTime = Math.max(0, Math.min(minutes - 30, 1440 - 60))
    const endTime = Math.min(startTime + 60, 1440)
    const isValid = !checkOverlap(startTime, endTime)

    setDropPreview({ startTime, endTime, isValid })
  }

  const handleTimelineMouseLeave = () => {
    if (draggingTaskId) {
      setDropPreview(null)
    }
  }

  const handleTimelineClick = async (e: React.MouseEvent) => {
    if (!draggingTaskId || !dropPreview || !dropPreview.isValid) return

    const task = tasks.find(t => t.id === draggingTaskId)
    if (!task) return

    const result = await createTimeLog({
      taskId: draggingTaskId,
      logDate: date,
      startTime: dropPreview.startTime,
      endTime: dropPreview.endTime,
    })

    if (result.error) {
      setError(result.error)
      setTimeout(() => setError(null), 2000)
    } else if (result.timeLog) {
      const color = getTaskColor(draggingTaskId, taskColorMap.current)
      setBlocks(prev => [...prev, {
        id: result.timeLog.id,
        taskId: draggingTaskId,
        taskName: task.details?.substring(0, 30) || 'Task',
        clientName: task.client?.name || 'Client',
        startTime: dropPreview.startTime,
        endTime: dropPreview.endTime,
        color,
      }])
    }

    setDropPreview(null)
  }

  // Optimistic delete - remove from UI immediately, then sync to DB
  const handleDeleteBlock = async (blockId: string) => {
    // Store the block in case we need to restore it
    const blockToDelete = blocks.find(b => b.id === blockId)
    
    // Optimistically remove from UI
    setBlocks(prev => prev.filter(b => b.id !== blockId))
    
    // Also remove from pending changes if it was there
    setPendingChanges(prev => {
      const updated = new Map(prev)
      updated.delete(blockId)
      return updated
    })
    
    // Sync to DB
    const result = await deleteTimeLog(blockId)
    if (result.error) {
      // Restore the block if delete failed
      if (blockToDelete) {
        setBlocks(prev => [...prev, blockToDelete])
      }
      setError(result.error)
      setTimeout(() => setError(null), 2000)
    }
  }

  // Generate hour markers
  const hours = Array.from({ length: 25 }, (_, i) => i)

  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'pending':
        return <span className="text-xs text-muted-foreground">Unsaved changes...</span>
      case 'saving':
        return (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Saving...
          </span>
        )
      case 'saved':
        return (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="size-3" />
            Saved
          </span>
        )
      case 'error':
        return <span className="text-xs text-destructive">Save failed</span>
      default:
        return null
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">
              {format(new Date(date), 'EEEE, MMMM d')}
            </CardTitle>
            {renderSaveStatus()}
          </div>
          {error && (
            <span className="text-sm text-destructive">{error}</span>
          )}
        </div>
        {draggingTaskId && (
          <p className="text-xs text-muted-foreground">Click on the timeline to place the task</p>
        )}
      </CardHeader>
      <CardContent className="p-2">
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto pb-2"
        >
          <div 
            ref={timelineRef}
            className={cn(
              "relative select-none",
              draggingTaskId && "cursor-crosshair"
            )}
            style={{ width: 24 * HOUR_WIDTH, height: TIMELINE_HEIGHT + 24, minWidth: '100%' }}
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={handleTimelineMouseLeave}
            onClick={handleTimelineClick}
          >
            {/* Hour markers */}
            <div className="absolute top-0 left-0 right-0 h-5 flex">
              {hours.map(hour => (
                <div
                  key={hour}
                  className="text-xs text-muted-foreground"
                  style={{ 
                    position: 'absolute',
                    left: hour * HOUR_WIDTH,
                    transform: 'translateX(-50%)'
                  }}
                >
                  {`${hour.toString().padStart(2, '0')}:00`}
                </div>
              ))}
            </div>

            {/* Timeline track */}
            <div 
              className="absolute left-0 right-0 bg-muted/50 rounded"
              style={{ top: 22, height: TIMELINE_HEIGHT }}
            >
              {/* Grid lines */}
              {hours.map(hour => (
                <div
                  key={hour}
                  className="absolute top-0 bottom-0 border-l border-border/40"
                  style={{ left: hour * HOUR_WIDTH }}
                />
              ))}
              
              {/* Half-hour grid lines */}
              {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                <div
                  key={`half-${hour}`}
                  className="absolute top-0 bottom-0 border-l border-border/20"
                  style={{ left: hour * HOUR_WIDTH + HOUR_WIDTH / 2 }}
                />
              ))}

              {/* Drop preview */}
              {dropPreview && (
                <div
                  className={cn(
                    'absolute top-1 bottom-1 rounded opacity-60 pointer-events-none border-2 border-dashed',
                    dropPreview.isValid ? 'bg-primary/30 border-primary' : 'bg-destructive/30 border-destructive'
                  )}
                  style={{
                    left: minutesToPosition(dropPreview.startTime),
                    width: minutesToPosition(dropPreview.endTime - dropPreview.startTime),
                  }}
                />
              )}

              {/* Time blocks */}
              <TooltipProvider>
                {blocks.map(block => {
                  const isBeingDragged = dragState?.blockId === block.id
                  const isPending = pendingChanges.has(block.id)
                  const hasOverlap = isBeingDragged && checkOverlap(block.startTime, block.endTime, block.id)
                  const blockWidth = minutesToPosition(block.endTime - block.startTime)

                  return (
                    <Tooltip key={block.id}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'absolute top-1 bottom-1 rounded cursor-move flex items-center overflow-hidden',
                            'hover:shadow-lg',
                            // Only apply transition when NOT being dragged (for smooth snapping after release)
                            !isBeingDragged && 'transition-all duration-150 ease-out',
                            hasOverlap && 'ring-2 ring-destructive',
                            isPending && 'ring-1 ring-yellow-400'
                          )}
                          style={{
                            left: minutesToPosition(block.startTime),
                            width: blockWidth,
                            backgroundColor: block.color,
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleDragStart(e, block.id, 'move')
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Resize handle - start */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20"
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              handleDragStart(e, block.id, 'resize-start')
                            }}
                          />

                          {/* Block content */}
                          {blockWidth > 60 && (
                            <div className="flex-1 min-w-0 text-white text-xs truncate px-2">
                              <div className="font-medium truncate">{block.clientName}</div>
                            </div>
                          )}

                          {/* Delete button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 text-white/80 hover:text-white hover:bg-black/20 shrink-0 mr-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteBlock(block.id)
                            }}
                          >
                            <X className="size-3" />
                          </Button>

                          {/* Resize handle - end */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20"
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              handleDragStart(e, block.id, 'resize-end')
                            }}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm">
                          <div className="font-medium">{block.clientName}</div>
                          <div className="text-muted-foreground">{block.taskName}</div>
                          <div className="text-muted-foreground">
                            {formatTime(block.startTime)} - {formatTime(block.endTime)}
                          </div>
                          <div className="font-medium">
                            {Math.round((block.endTime - block.startTime) / 60 * 10) / 10}h
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </TooltipProvider>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
