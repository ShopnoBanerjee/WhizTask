'use client'

import { useState, useEffect, useTransition } from 'react'
import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { getEmployeeTaskHistory } from '@/lib/employee/actions'
import { DEPARTMENTS } from '@/types/database'
import type { TaskWithRelations } from '@/types/database'

interface HistoryData {
  data: TaskWithRelations[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export function EmployeeHistory() {
  const [history, setHistory] = useState<HistoryData>({
    data: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  })
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({ from: undefined, to: undefined })
  const [isPending, startTransition] = useTransition()

  const fetchHistory = (page: number = 1) => {
    startTransition(async () => {
      const filters: Parameters<typeof getEmployeeTaskHistory>[0] = {
        page,
        limit: 10,
      }

      if (dateRange.from && dateRange.to) {
        filters.startDate = dateRange.from.toISOString()
        filters.endDate = dateRange.to.toISOString()
      }

      const result = await getEmployeeTaskHistory(filters)
      setHistory(result)
    })
  }

  useEffect(() => {
    fetchHistory(1)
  }, [dateRange])

  const getDepartmentLabel = (dept: string) => {
    return DEPARTMENTS.find(d => d.value === dept)?.label || dept
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 size-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, 'LLL dd, y')} -{' '}
                    {format(dateRange.to, 'LLL dd, y')}
                  </>
                ) : (
                  format(dateRange.from, 'LLL dd, y')
                )
              ) : (
                'Filter by date range'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {(dateRange.from || dateRange.to) && (
          <Button
            variant="ghost"
            onClick={() => setDateRange({ from: undefined, to: undefined })}
          >
            Clear Dates
          </Button>
        )}
      </div>

      {/* History table */}
      <Card>
        <CardContent className="p-0">
          {isPending ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.data.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No completed tasks found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Task Details</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data.map(task => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">
                      {task.client?.name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getDepartmentLabel(task.department)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {task.details || 'No details'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(task.updated_at), 'MMM d, yyyy h:mm a')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {history.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => fetchHistory(Math.max(1, history.page - 1))}
                className={history.page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            
            {Array.from({ length: Math.min(5, history.totalPages) }, (_, i) => {
              const pageNum = i + 1
              return (
                <PaginationItem key={pageNum}>
                  <PaginationLink
                    onClick={() => fetchHistory(pageNum)}
                    isActive={history.page === pageNum}
                    className="cursor-pointer"
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              )
            })}
            
            <PaginationItem>
              <PaginationNext
                onClick={() => fetchHistory(Math.min(history.totalPages, history.page + 1))}
                className={history.page >= history.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
