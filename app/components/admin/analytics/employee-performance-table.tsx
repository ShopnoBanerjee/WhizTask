'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CheckCircle, Clock, TrendingUp } from 'lucide-react'
import type { EmployeePerformance } from '@/types/database'

interface EmployeePerformanceTableProps {
  data: EmployeePerformance[]
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)

function ProgressBar({ value, max = 100, color = 'bg-primary' }: { value: number; max?: number; color?: string }) {
  const percentage = Math.min((value / max) * 100, 100)
  return (
    <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${percentage}%` }} />
    </div>
  )
}

export function EmployeePerformanceTable({ data }: EmployeePerformanceTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Employee Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No performance data available
          </p>
        </CardContent>
      </Card>
    )
  }

  const topPerformer = data.reduce((best, emp) => 
    emp.totalHoursLogged > best.totalHoursLogged ? emp : best
  , data[0])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Employee Performance</CardTitle>
          {topPerformer && (
            <Badge variant="outline" className="gap-1">
              <TrendingUp className="size-3" />
              Top: {topPerformer.employeeName || topPerformer.email.split('@')[0]}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 justify-center">
                        <CheckCircle className="size-3" />
                        Tasks
                      </TooltipTrigger>
                      <TooltipContent>Completed / Assigned</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-center">Completion</TableHead>
                <TableHead className="text-center">On-Time</TableHead>
                <TableHead className="text-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 justify-center">
                        <Clock className="size-3" />
                        Hours
                      </TooltipTrigger>
                      <TooltipContent>Total hours logged</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(emp => (
                <TableRow key={emp.employeeId}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{emp.employeeName || emp.email.split('@')[0]}</p>
                      <p className="text-xs text-muted-foreground">{emp.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-medium">{emp.tasksCompleted}</span>
                    <span className="text-muted-foreground">/{emp.tasksAssigned}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <ProgressBar 
                        value={emp.completionRate} 
                        color={emp.completionRate >= 80 ? 'bg-green-500' : emp.completionRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}
                      />
                      <span className="text-sm w-10">{emp.completionRate.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <ProgressBar 
                        value={emp.onTimeRate} 
                        color={emp.onTimeRate >= 80 ? 'bg-green-500' : emp.onTimeRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}
                      />
                      <span className="text-sm w-10">{emp.onTimeRate.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {emp.totalHoursLogged.toFixed(1)}h
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    {formatCurrency(emp.valueGenerated)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
