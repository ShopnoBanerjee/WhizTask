import { format } from 'date-fns'
import { TimeLoggerWrapper } from '@/components/employee/time-logger-wrapper'
import { 
  getEmployeeActiveTasks, 
  getTimeLogs, 
  getEmployeeProfile
} from '@/lib/employee/actions'
import { redirect } from 'next/navigation'

export default async function TimeLoggerPage() {
  const profile = await getEmployeeProfile()
  
  if (!profile) {
    redirect('/auth/login')
  }

  if (!profile.has_completed_onboarding) {
    redirect('/employee/onboarding')
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  
  const [activeTasks, timeLogs] = await Promise.all([
    getEmployeeActiveTasks(),
    getTimeLogs(today),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Time Logger</h1>
        <p className="text-muted-foreground">
          Log your time and track your daily tasks
        </p>
      </div>
      <TimeLoggerWrapper 
        tasks={activeTasks} 
        initialLogs={timeLogs}
        initialDate={today}
      />
    </div>
  )
}
