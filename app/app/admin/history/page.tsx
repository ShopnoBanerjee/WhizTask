import { HistoryTasks } from '@/components/admin/history-tasks'

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Task History</h1>
        <p className="text-muted-foreground">View all task logs and history</p>
      </div>

      <HistoryTasks />
    </div>
  )
}
