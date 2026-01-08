import { EmployeeHistory } from '@/components/employee/employee-history'

export default function EmployeeHistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Task History</h1>
        <p className="text-muted-foreground">View your completed tasks and time logs</p>
      </div>

      <EmployeeHistory />
    </div>
  )
}
