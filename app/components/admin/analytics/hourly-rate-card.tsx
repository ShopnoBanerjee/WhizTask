'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { EmployeeHourlyRate } from '@/types/database'

interface HourlyRateCardProps {
  employees: EmployeeHourlyRate[]
  avgHourlyRate: number
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)

export function HourlyRateCard({ employees, avgHourlyRate }: HourlyRateCardProps) {
  const employeesWithCTC = employees.filter(e => e.ctcPerMonth > 0)
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Employee Hourly Rates</CardTitle>
        <p className="text-sm text-muted-foreground">
          CTC ÷ (22 working days × 8 hours)
        </p>
      </CardHeader>
      <CardContent>
        {/* An average of nothing is not ₹0: only show it once salaries exist */}
        {employeesWithCTC.length > 0 && (
          <div className="mb-4 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Organization Average</p>
            <p className="text-2xl font-bold">
              {formatCurrency(avgHourlyRate)}<span className="text-sm font-normal text-muted-foreground">/hr</span>
            </p>
          </div>
        )}

        {employeesWithCTC.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No salaries entered yet. Add each person&apos;s monthly CTC in the Settings tab to get hourly rates and labour costs.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">CTC/Month</TableHead>
                <TableHead className="text-right">Hourly Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeesWithCTC.map(emp => (
                <TableRow key={emp.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{emp.name || emp.email}</p>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {emp.departments.slice(0, 2).map(dept => (
                          <Badge key={dept} variant="outline" className="text-xs">
                            {dept.replace('_', ' ')}
                          </Badge>
                        ))}
                        {emp.departments.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{emp.departments.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(emp.ctcPerMonth)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(emp.hourlyRate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
