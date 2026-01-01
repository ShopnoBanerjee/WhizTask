

import { format } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TimeLoggerWrapper } from '@/components/employee/time-logger-wrapper'
import { EmployeeTaskList } from '@/components/employee/employee-task-list'
import { EmployeeHistory } from '@/components/employee/employee-history'
import { ProfileSettings } from '@/components/employee/profile-settings'
import { 
  getEmployeeActiveTasks, 
  getEmployeeTasks, 
  getTimeLogs, 
  getEmployeeProfile,
  getEmployeeDepartments
} from '@/lib/employee/actions'
import { redirect } from 'next/navigation'

export default async function EmployeePage() {
  const profile = await getEmployeeProfile()
  
  if (!profile) {
    redirect('/auth/login')
  }

  if (!profile.has_completed_onboarding) {
    redirect('/employee/onboarding')
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  
  const [
    activeTasks,
    allTasks,
    timeLogs,
    departments,
  ] = await Promise.all([
    getEmployeeActiveTasks(),
    getEmployeeTasks(),
    getTimeLogs(today),
    getEmployeeDepartments(),
  ])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">
            Welcome{profile.name ? `, ${profile.name}` : ''}
          </h1>
          <p className="text-muted-foreground">
            Manage your tasks and log your time
          </p>
        </div>

        {/* Main content */}
        <Tabs defaultValue="timelogger" className="space-y-4">
          <TabsList>
            <TabsTrigger value="timelogger">Time Logger</TabsTrigger>
            <TabsTrigger value="tasks">My Tasks</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="timelogger">
            <TimeLoggerWrapper 
              tasks={activeTasks} 
              initialLogs={timeLogs}
              initialDate={today}
            />
          </TabsContent>

          <TabsContent value="tasks">
            <EmployeeTaskList initialTasks={allTasks} />
          </TabsContent>

          <TabsContent value="history">
            <EmployeeHistory />
          </TabsContent>

          <TabsContent value="profile">
            <ProfileSettings profile={profile} departments={departments} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
