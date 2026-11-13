'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getTasks, getTasksPageData } from '@/lib/admin/actions'
import { CreateTaskForm } from '@/components/admin/create-task-form'
import { TaskList } from '@/components/admin/task-list'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { todayLocal, dayStartIso, dayEndIso } from '@/lib/dates'
import type { TaskWithRelations, Client, EmployeeWithDepartments, Department, TaskStatus, TaskFilters } from '@/types/database'
import { DEPARTMENTS } from '@/types/database'

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  // Filter state. The start date defaults to today, set after mount so the
  // server-rendered HTML (UTC clock) and the browser agree. An empty end date
  // means "no upper limit", so the default view is everything due from today.
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [clientId, setClientId] = useState('all')
  const [assignedTo, setAssignedTo] = useState('all')
  const [department, setDepartment] = useState<Department | 'all'>('all')
  const [status, setStatus] = useState<TaskStatus | 'all'>('all')
  const [ready, setReady] = useState(false)

  // options for the filter dropdowns and the create/edit dialogs
  const [clients, setClients] = useState<Client[]>([])
  const [employees, setEmployees] = useState<EmployeeWithDepartments[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)

  const optionsLoaded = useRef(false)
  const latestRequest = useRef(0)

  useEffect(() => {
    setStartDate(todayLocal())
    setReady(true)
  }, [])

  const loadTasks = useCallback(async () => {
    // Ignore responses that arrive after a newer request was made, so a slow
    // earlier query can't overwrite the results for the current filters
    const requestId = ++latestRequest.current
    setLoading(true)
    try {
      const filters: TaskFilters = {
        // Whole days in the viewer's timezone. Sending a bare date compared
        // it as midnight UTC, which dropped tasks due on the end date and
        // shifted "today" by the UTC offset.
        startDate: startDate ? dayStartIso(startDate) : undefined,
        endDate: endDate ? dayEndIso(endDate) : undefined,
        clientId: clientId === 'all' ? undefined : clientId,
        assignedTo: assignedTo === 'all' ? undefined : assignedTo,
        department: department === 'all' ? undefined : department,
        status: status === 'all' ? undefined : status,
      }

      if (!optionsLoaded.current) {
        // First load: tasks and dropdown options in one request
        const result = await getTasksPageData(filters)
        optionsLoaded.current = true
        setClients(result.clients)
        setEmployees(result.employees)
        setOrgId(result.orgId)
        if (requestId === latestRequest.current) setTasks(result.tasks)
      } else {
        const result = await getTasks(filters)
        if (requestId === latestRequest.current) setTasks(result)
      }
    } catch (err) {
      console.error('Error loading tasks:', err)
      if (requestId === latestRequest.current) setTasks([])
    } finally {
      if (requestId === latestRequest.current) setLoading(false)
    }
  }, [startDate, endDate, clientId, assignedTo, department, status])

  useEffect(() => {
    if (ready) loadTasks()
  }, [ready, loadTasks])

  const handleReset = () => {
    setStartDate(todayLocal())
    setEndDate('')
    setClientId('all')
    setAssignedTo('all')
    setDepartment('all')
    setStatus('all')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold">Tasks</h1>
          {loading && (
            <Loader2 className="ml-2 size-5 animate-spin text-muted-foreground" />
          )}
        </div>
        <CreateTaskForm
          clients={clients}
          employees={employees}
          orgId={orgId}
          onTaskCreated={loadTasks}
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label htmlFor="filter-start">Due from</Label>
          <Input
            id="filter-start"
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-end">Due until</Label>
          <Input
            id="filter-end"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Assigned To</Label>
          <Select value={assignedTo} onValueChange={setAssignedTo}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {employees.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name || e.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Department</Label>
          <Select
            value={department}
            onValueChange={v => setDepartment(v as Department | 'all')}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {DEPARTMENTS.map(d => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={v => setStatus(v as TaskStatus | 'all')}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 self-end">
          <Button variant="ghost" onClick={handleReset}>Reset</Button>
        </div>
      </div>

      {/* Keep the current results on screen while a new filter loads */}
      <div className={loading && tasks.length > 0 ? 'opacity-60 transition-opacity' : undefined}>
        {tasks.length > 0 ? (
          <TaskList tasks={tasks} clients={clients} employees={employees} orgId={orgId} />
        ) : loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            {startDate || endDate
              ? 'No tasks are due in this date range. Clear the dates to see every task.'
              : 'No tasks match these filters.'}
          </div>
        )}
      </div>
    </div>
  )
}
