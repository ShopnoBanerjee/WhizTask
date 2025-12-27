'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { upsertOverhead } from '@/lib/admin/client-actions'
import { OVERHEAD_CATEGORIES, type Overhead, type OverheadCategory } from '@/types/database'

interface OverheadFormProps {
  overheads: Overhead[]
}

export function OverheadForm({ overheads }: OverheadFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [values, setValues] = useState<Record<OverheadCategory, string>>(() => {
    const initial: Record<OverheadCategory, string> = {
      rent: '',
      board_salary: '',
      electricity: '',
      maintenance: '',
      others: '',
    }
    overheads.forEach(o => {
      initial[o.category] = o.value_per_month.toString()
    })
    return initial
  })

  function handleChange(category: OverheadCategory, value: string) {
    setValues(prev => ({ ...prev, [category]: value }))
    setSuccess(false)
  }

  async function handleSave() {
    setError(null)
    setSuccess(false)

    startTransition(async () => {
      for (const category of OVERHEAD_CATEGORIES) {
        const value = parseFloat(values[category.value]) || 0
        const formData = new FormData()
        formData.append('category', category.value)
        formData.append('value_per_month', value.toString())
        
        const result = await upsertOverhead(formData)
        if (result.error) {
          setError(result.error)
          return
        }
      }
      setSuccess(true)
    })
  }

  const totalMonthly = Object.values(values).reduce((sum, val) => sum + (parseFloat(val) || 0), 0)

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>Overhead settings saved successfully!</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {OVERHEAD_CATEGORIES.map((category) => (
          <Card key={category.value}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{category.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor={category.value}>Monthly Amount (₹)</Label>
                <Input
                  id={category.value}
                  type="number"
                  step="0.01"
                  min="0"
                  value={values[category.value]}
                  onChange={(e) => handleChange(category.value, e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Monthly Overhead</p>
              <p className="text-2xl font-bold">{formatCurrency(totalMonthly)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Apportioned across retainership clients based on their contribution
              </p>
            </div>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
