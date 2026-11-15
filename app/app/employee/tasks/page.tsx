import { EmployeeTaskList } from '@/components/employee/employee-task-list'
import { getEmployeeClients } from '@/lib/employee/actions'
import { getOrgContext } from '@/lib/auth/context'

export default async function EmployeeTasksPage() {
  // Tasks are loaded by the list itself: it defaults to "due from today",
  // and today depends on the viewer's timezone
  const [ctx, clients] = await Promise.all([getOrgContext(), getEmployeeClients()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <p className="text-muted-foreground">View and manage all your assigned tasks</p>
      </div>

      <EmployeeTaskList clients={clients} currentUserId={ctx?.userId || ''} />
    </div>
  )
}
