'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { PaginatedTasks, Client, EmployeeWithDepartments, TaskWithRelations } from '@/types/database'
import { getHistoryTasks, getTaskFormOptions } from '@/lib/admin/actions'
import { dayStartIso, dayEndIso } from '@/lib/dates'
import { DEPARTMENTS } from '@/types/database'
import { getStatusColor, getDepartmentColor } from '@/lib/taskColors'

interface HistoryTasksProps {
  initialData?: PaginatedTasks
}

export function HistoryTasks({ initialData }: HistoryTasksProps) {
  const [data, setData] = useState<PaginatedTasks>(initialData || {
    data: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  })
  const [loading, setLoading] = useState(true)
  const latestRequest = useRef(0)
  const [clients, setClients] = useState<Client[]>([])
  const [employees, setEmployees] = useState<EmployeeWithDepartments[]>([])

  // Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [clientId, setClientId] = useState('all')
  const [assignedTo, setAssignedTo] = useState('all')

  // The page number only applies to the filters it was chosen under, so
  // changing a filter starts again from page 1. Staying on, say, page 4 of a
  // result that now has one page showed "No tasks found".
  const filterKey = [startDate, endDate, clientId, assignedTo].join('|')
  const [pageFor, setPageFor] = useState({ key: filterKey, page: 1 })
  const page = pageFor.key === filterKey ? pageFor.page : 1

  const loadFilters = async () => {
    // one request for both dropdowns
    const options = await getTaskFormOptions()
    setClients(options.clients)
    setEmployees(options.employees)
  }

  const loadTasks = useCallback(async () => {
    // Ignore responses that arrive after a newer request was made, so a slow
    // earlier query can't overwrite the results for the current filters
    const requestId = ++latestRequest.current
    setLoading(true)
    try {
      const result = await getHistoryTasks({
        page,
        limit: 10,
        // whole days in the viewer's timezone; each bound works on its own
        startDate: startDate ? dayStartIso(startDate) : undefined,
        endDate: endDate ? dayEndIso(endDate) : undefined,
        clientId: clientId === 'all' ? undefined : clientId,
        assignedTo: assignedTo === 'all' ? undefined : assignedTo,
      })
      if (requestId === latestRequest.current) setData(result)
    } catch (error) {
      console.error('Error loading tasks:', error)
    } finally {
      if (requestId === latestRequest.current) setLoading(false)
    }
  }, [page, startDate, endDate, clientId, assignedTo])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  useEffect(() => {
    loadFilters()
  }, [])

  const handlePageChange = (next: number) => {
    setPageFor({ key: filterKey, page: next })
  }

  // Tasks split into subtasks have no assignee of their own: list the people
  // working on the subtasks instead of showing "Unassigned"
  const getAssignees = (task: TaskWithRelations) => {
    if (task.assigned_employee) return task.assigned_employee.name || task.assigned_employee.email
    const names = [...new Set(
      (task.subtasks || [])
        .map(st => st.assigned_employee?.name || st.assigned_employee?.email)
        .filter((n): n is string => !!n)
    )]
    return names.length > 0 ? names.join(', ') : 'Unassigned'
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm')
  }

  const getDepartmentLabel = (department: string) => {
    return DEPARTMENTS.find(d => d.value === department)?.label || department
  }

  if (data.data.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
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
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name || employee.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">No tasks found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your filters or check back later
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label>Start Date</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>End Date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
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
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
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
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name || employee.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Last Updated</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="text-sm">
                    {formatDate(task.updated_at)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {task.client?.name || 'Unknown client'}
                  </TableCell>
                  <TableCell>
                    <Badge className={getDepartmentColor(task.department)}>
                      {getDepartmentLabel(task.department)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('capitalize', getStatusColor(task.status))}>
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {getAssignees(task)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {task.details || 'No details'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>  

      {data.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => handlePageChange(Math.max(1, data.page - 1))}
                className={data.page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>

            {Array.from({ length: data.totalPages }, (_, i) => i + 1)
              .filter(page => {
                const distance = Math.abs(page - data.page)
                return distance === 0 || distance === 1 || page === 1 || page === data.totalPages
              })
              .map((page, index, array) => {
                const prevPage = array[index - 1]
                const showEllipsis = prevPage && page - prevPage > 1

                return (
                  <div key={page}>
                    {showEllipsis && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    <PaginationItem>
                      <PaginationLink
                        onClick={() => handlePageChange(page)}
                        isActive={page === data.page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  </div>
                )
              })}

            <PaginationItem>
              <PaginationNext
                onClick={() => handlePageChange(Math.min(data.totalPages, data.page + 1))}
                className={data.page === data.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Showing {data.data.length} of {data.total} tasks
      </p>
    </div>
  )
}