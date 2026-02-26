'use client'

import { useState, useEffect, useCallback } from 'react'
import { getTasks, getClients, getOrgEmployees } from '@/lib/admin/actions'
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
import { Loader2 } from 'lucide-react'  // spinner used when reloading tasks
import type { TaskWithRelations, Client, EmployeeWithDepartments, Department, TaskStatus } from '@/types/database'
import { DEPARTMENTS } from '@/types/database'

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  // filter state
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [clientId, setClientId] = useState('all')
  const [assignedTo, setAssignedTo] = useState('all')
  const [department, setDepartment] = useState<Department | 'all'>('all')
  const [status, setStatus] = useState<TaskStatus | 'all'>('all')

  // options for selects
  const [clients, setClients] = useState<Client[]>([])
  const [employees, setEmployees] = useState<EmployeeWithDepartments[]>([])

  // load clients and employees for filter dropdowns
  const loadFilterData = async () => {
    const [clientsData, employeesData] = await Promise.all([getClients(), getOrgEmployees()])
    setClients(clientsData)
    setEmployees(employeesData)
  }

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = {}

      // if start/end specified use range
      if (startDate && endDate) {
        params.startDate = startDate
        params.endDate = endDate
      } else if (startDate && !endDate) {
        // user entered only a start date, default the end to today
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        params.startDate = startDate
        params.endDate = today.toISOString()
      } else {
        // no dates provided; use today's date filter
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        params.date = today.toISOString()
      }

      if (clientId !== 'all') params.clientId = clientId
      if (assignedTo !== 'all') params.assignedTo = assignedTo
      if (department !== 'all') params.department = department
      if (status !== 'all') params.status = status

      const result = await getTasks(params)
      setTasks(result)
    } catch (err) {
      console.error('Error loading tasks:', err)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, clientId, assignedTo, department, status])

  useEffect(() => {
    loadFilterData()
  }, [])

  // when the user picks a start date without an end, automatically
  // populate the end date with today to avoid empty-result queries
  useEffect(() => {
    if (startDate && !endDate) {
      const todayStr = new Date().toISOString().split('T')[0]
      setEndDate(todayStr)
    }
  }, [startDate])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleTaskCreated = (newTask: TaskWithRelations) => {
    // simply reload current filter set to ensure consistency
    loadTasks()
  }

  // rather than completely returning early while fetching, keep the filters
  // and header visible and show a spinner in the task area (see history-tasks
  // for reference). this avoids the feeling of a full page reload when the
  // user adjusts one of the controls.

  const handleReset = () => {
    setStartDate('')
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
        <CreateTaskForm onTaskCreated={handleTaskCreated} />
      </div>

      {/* filters similar to history page */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label>Start Date</Label>
          <Input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-1">
          <Label>End Date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-1">
          <Label>Client</Label>
          <Select value={clientId} onValueChange={setClientId} disabled={loading}>
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
          <Select value={assignedTo} onValueChange={setAssignedTo} disabled={loading}>
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
            disabled={loading}
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
            disabled={loading}
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
          <Button variant="ghost" onClick={handleReset} disabled={loading}>Reset</Button>
        </div>
      </div>

      {/* table or loading state is rendered in place so filters stay put */}
      <div>
        {loading ? (
          <div className="text-center py-8">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No tasks found – try adjusting the filters.
          </div>
        ) : (
          <TaskList tasks={tasks} />
        )}
      </div>
    </div>
  )
}
