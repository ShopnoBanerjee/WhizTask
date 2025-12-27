import { getTasks } from '@/lib/admin/actions'
import { CreateTaskForm } from '@/components/admin/create-task-form'
import { TaskList } from '@/components/admin/task-list'

export default async function TasksPage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const tasks = await getTasks({ date: today.toISOString() })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">Manage and assign tasks to your team</p>
        </div>
        <CreateTaskForm />
      </div>

      <TaskList initialTasks={tasks} />
    </div>
  )
}
