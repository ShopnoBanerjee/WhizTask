'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pencil, Save, X } from 'lucide-react'
import { updateEmployeeCTC } from '@/lib/admin/analytics-actions'
import type { EmployeeHourlyRate } from '@/types/database'

interface CTCManagementProps {
  employees: EmployeeHourlyRate[]
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)

export function CTCManagement({ employees: initialEmployees }: CTCManagementProps) {
  const [employees, setEmployees] = useState(initialEmployees)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEdit = (emp: EmployeeHourlyRate) => {
    setEditingId(emp.id)
    setEditValue(emp.ctcPerMonth.toString())
    setError(null)
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditValue('')
    setError(null)
  }

  const handleSave = async (employeeId: string) => {
    const ctc = parseFloat(editValue)
    if (isNaN(ctc) || ctc < 0) {
      setError('Please enter a valid amount')
      return
    }

    setSaving(true)
    const result = await updateEmployeeCTC(employeeId, ctc)
    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }

    // Update local state
    setEmployees(prev => prev.map(emp => 
      emp.id === employeeId 
        ? { 
            ...emp, 
            ctcPerMonth: ctc, 
            hourlyRate: ctc / (22 * 8) 
          }
        : emp
    ))
    setEditingId(null)
    setEditValue('')
  }

  const employeesWithCTC = employees.filter(e => e.ctcPerMonth > 0).length
  const totalCTC = employees.reduce((sum, e) => sum + e.ctcPerMonth, 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Employee CTC Management</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Set monthly CTC to calculate hourly rates
            </p>
          </div>
          <Badge variant="secondary">
            {employeesWithCTC}/{employees.length} configured
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {employees.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No employees found
          </p>
        ) : (
          <>
            <div className="mb-4 p-3 bg-muted/50 rounded-lg flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Monthly CTC</span>
              <span className="font-bold">{formatCurrency(totalCTC)}</span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Departments</TableHead>
                  <TableHead className="text-right">CTC/Month</TableHead>
                  <TableHead className="text-right">Hourly Rate</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map(emp => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{emp.name || 'Unnamed'}</p>
                        <p className="text-xs text-muted-foreground">{emp.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
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
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === emp.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-32 text-right"
                            placeholder="0"
                            min="0"
                          />
                        </div>
                      ) : (
                        <span className={emp.ctcPerMonth === 0 ? 'text-muted-foreground' : ''}>
                          {emp.ctcPerMonth > 0 ? formatCurrency(emp.ctcPerMonth) : 'Not set'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {emp.hourlyRate > 0 ? formatCurrency(emp.hourlyRate) : '-'}
                    </TableCell>
                    <TableCell>
                      {editingId === emp.id ? (
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSave(emp.id)}
                            disabled={saving}
                          >
                            <Save className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={handleCancel}
                            disabled={saving}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(emp)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {error && (
              <p className="text-sm text-destructive mt-2">{error}</p>
            )}

            <p className="text-xs text-muted-foreground mt-4">
              Hourly Rate = CTC ÷ (22 working days × 8 hours)
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
