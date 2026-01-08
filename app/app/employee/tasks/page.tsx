import { EmployeeTaskList } from '@/components/employee/employee-task-list'
import { getEmployeeTasks } from '@/lib/employee/actions'

export default async function EmployeeTasksPage() {
  const tasks = await getEmployeeTasks()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <p className="text-muted-foreground">View and manage all your assigned tasks</p>
      </div>

      <EmployeeTaskList initialTasks={tasks} />
    </div>
  )
}
