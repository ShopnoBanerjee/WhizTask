'use client'

import { useState, useEffect } from 'react'
import { getTasks } from '@/lib/admin/actions'
import { CreateTaskForm } from '@/components/admin/create-task-form'
import { TaskList } from '@/components/admin/task-list'
import type { TaskWithRelations } from '@/types/database'

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTasks = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const initialTasks = await getTasks({ date: today.toISOString() })
      setTasks(initialTasks)
      setLoading(false)
    }

    loadTasks()
  }, [])

  const handleTaskCreated = (newTask: TaskWithRelations) => {
    setTasks(prev => [newTask, ...prev])
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tasks</h1>
            <p className="text-muted-foreground">Manage and assign tasks to your team</p>
          </div>
        </div>
        <div className="text-center py-8">Loading tasks...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">Manage and assign tasks to your team</p>
        </div>
        <CreateTaskForm onTaskCreated={handleTaskCreated} />
      </div>

      <TaskList tasks={tasks} />
    </div>
  )
}
