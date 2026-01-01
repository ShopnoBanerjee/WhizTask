'use client'

import { useState } from 'react'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CalendarIcon, Clock, Users, TrendingUp, DollarSign, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HourlyRateCard } from '@/components/admin/analytics/hourly-rate-card'
import { ClientHoursChart } from '@/components/admin/analytics/client-hours-chart'
import { ClientProfitabilityChart } from '@/components/admin/analytics/client-profitability-chart'
import { EmployeePerformanceTable } from '@/components/admin/analytics/employee-performance-table'
import { CTCManagement } from '@/components/admin/analytics/ctc-management'
import type { 
  EmployeeHourlyRate, 
  ClientManHours, 
  ClientProfitability, 
  EmployeePerformance,
  AnalyticsSummary 
} from '@/types/database'

interface AnalyticsDashboardProps {
  initialData: {
    summary: AnalyticsSummary
    employeeRates: EmployeeHourlyRate[]
    clientHours: ClientManHours[]
    clientProfitability: ClientProfitability[]
    employeePerformance: EmployeePerformance[]
  }
  startDate: string
  endDate: string
}

type DatePreset = '7d' | '30d' | '90d' | 'this_month' | 'last_month' | 'custom'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)

function SummaryCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  trend 
}: { 
  title: string
  value: string
  subtitle?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={cn(
              'text-2xl font-bold mt-1',
              trend === 'up' && 'text-green-600',
              trend === 'down' && 'text-red-600'
            )}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className="p-2 bg-muted rounded-lg">
            <Icon className="size-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AnalyticsDashboard({ initialData, startDate, endDate }: AnalyticsDashboardProps) {
  const [preset, setPreset] = useState<DatePreset>('30d')
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(startDate),
    to: new Date(endDate),
  })
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)

  const handlePresetChange = async (value: DatePreset) => {
    setPreset(value)
    
    let from: Date
    let to: Date = new Date()

    switch (value) {
      case '7d':
        from = subDays(to, 7)
        break
      case '30d':
        from = subDays(to, 30)
        break
      case '90d':
        from = subDays(to, 90)
        break
      case 'this_month':
        from = startOfMonth(to)
        to = endOfMonth(to)
        break
      case 'last_month':
        const lastMonth = subMonths(to, 1)
        from = startOfMonth(lastMonth)
        to = endOfMonth(lastMonth)
        break
      default:
        return
    }

    setDateRange({ from, to })
    await fetchData(from, to)
  }

  const handleCustomDateChange = async (range: { from?: Date; to?: Date }) => {
    if (range.from && range.to) {
      setPreset('custom')
      setDateRange({ from: range.from, to: range.to })
      await fetchData(range.from, range.to)
    }
  }

  const fetchData = async (from: Date, to: Date) => {
    setLoading(true)
    try {
      const startStr = format(from, 'yyyy-MM-dd')
      const endStr = format(to, 'yyyy-MM-dd')
      
      // Fetch new data via API route
      const res = await fetch(`/api/admin/analytics?start=${startStr}&end=${endStr}`)
      if (res.ok) {
        const newData = await res.json()
        setData(newData)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const { summary, employeeRates, clientHours, clientProfitability, employeePerformance } = data

  return (
    <div className="space-y-6">
      {/* Header with date filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            {format(dateRange.from, 'MMM d, yyyy')} - {format(dateRange.to, 'MMM d, yyyy')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={preset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="size-4" />
                Custom Range
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    handleCustomDateChange({ from: range.from, to: range.to })
                  }
                }}
                numberOfMonths={2}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1">
            <Settings className="size-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-6">
          {/* Summary cards */}
          <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', loading && 'opacity-50')}>
            <SummaryCard
              title="Total Hours Logged"
              value={`${summary.totalHoursLogged.toFixed(1)}h`}
              subtitle={`${summary.totalEmployees} employees`}
              icon={Clock}
            />
            <SummaryCard
              title="Avg Hourly Rate"
              value={formatCurrency(summary.avgHourlyRate)}
              subtitle="Per employee"
              icon={Users}
            />
            <SummaryCard
              title="Total Revenue"
              value={formatCurrency(summary.totalRevenue)}
              subtitle={`Cost: ${formatCurrency(summary.totalCost)}`}
              icon={DollarSign}
            />
            <SummaryCard
              title="Net Profit"
              value={formatCurrency(summary.netProfit)}
              subtitle={`${summary.profitMargin.toFixed(1)}% margin`}
              icon={TrendingUp}
              trend={summary.netProfit >= 0 ? 'up' : 'down'}
            />
          </div>

          {/* Charts grid */}
          <div className={cn('grid gap-6 lg:grid-cols-2', loading && 'opacity-50')}>
            <ClientHoursChart data={clientHours} />
            <HourlyRateCard employees={employeeRates} avgHourlyRate={summary.avgHourlyRate} />
          </div>

          {/* Profitability chart - full width */}
          <div className={cn(loading && 'opacity-50')}>
            <ClientProfitabilityChart data={clientProfitability} />
          </div>

          {/* Employee performance - full width */}
          <div className={cn(loading && 'opacity-50')}>
            <EmployeePerformanceTable data={employeePerformance} />
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <CTCManagement employees={employeeRates} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
