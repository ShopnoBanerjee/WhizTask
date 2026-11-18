'use client'

import { useState } from 'react'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { Card } from '@/components/ui/card'
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
import { CalendarIcon, Settings } from 'lucide-react'
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

// The period's money in one divided panel: label over figure, no icons.
// Revenue leads because it answers the screen's question; profit is only
// coloured when it is a loss, and a margin is only shown when there are costs
// to measure it against.
function SummaryStrip({ summary }: { summary: AnalyticsSummary }) {
  const hasCosts = summary.totalCost > 0
  const clients = summary.clientCount ?? 0
  const people = summary.employeeCount ?? summary.totalEmployees

  const cells = [
    {
      label: 'Revenue',
      value: formatCurrency(summary.totalRevenue),
      note: `${formatCurrency(summary.monthlyRevenue ?? 0)} a month across ${clients} client${clients === 1 ? '' : 's'}`,
      lead: true,
    },
    {
      label: 'Costs',
      value: formatCurrency(summary.totalCost),
      note: hasCosts ? 'Labour, software and overheads' : 'None recorded for this period',
    },
    {
      label: 'Net profit',
      value: formatCurrency(summary.netProfit),
      note: hasCosts ? `${summary.profitMargin.toFixed(1)}% margin` : 'Margin needs cost data',
      loss: summary.netProfit < 0,
    },
    {
      label: 'Hours logged',
      value: `${summary.totalHoursLogged.toFixed(1)} h`,
      note: `${summary.totalEmployees} of ${people} ${people === 1 ? 'person has' : 'people have'} a salary set`,
    },
  ]

  return (
    <Card className="py-0">
      <dl className="grid divide-y lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        {cells.map((cell) => (
          <div key={cell.label} className="px-6 py-5">
            <dt className="text-sm text-muted-foreground">{cell.label}</dt>
            <dd
              className={cn(
                'mt-1 font-semibold tabular-nums',
                cell.lead ? 'text-3xl' : 'text-2xl',
                cell.loss && 'text-red-400'
              )}
            >
              {cell.value}
            </dd>
            <dd className="mt-1 text-xs text-muted-foreground">{cell.note}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

// One sentence on what the period's numbers mean
function findingFor(summary: AnalyticsSummary): string {
  if (summary.totalCost <= 0) {
    return 'No costs are recorded, so profit equals revenue. Add salaries in Settings to see real margins.'
  }
  if (summary.netProfit < 0) {
    return `Running at a loss of ${formatCurrency(Math.abs(summary.netProfit))} for this period.`
  }
  return `Net profit of ${formatCurrency(summary.netProfit)} at a ${summary.profitMargin.toFixed(1)}% margin.`
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
          <p className="mt-1 text-sm">{findingFor(summary)}</p>
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
          {/* Summary */}
          <div className={cn(loading && 'opacity-50')}>
            <SummaryStrip summary={summary} />
          </div>

          {/* Profitability first: it is the block that explains the summary */}
          <div className={cn(loading && 'opacity-50')}>
            <ClientProfitabilityChart data={clientProfitability} />
          </div>

          {/* Each card keeps its own height, so an empty one stays small */}
          <div className={cn('grid items-start gap-6 lg:grid-cols-2', loading && 'opacity-50')}>
            <ClientHoursChart data={clientHours} />
            <HourlyRateCard employees={employeeRates} avgHourlyRate={summary.avgHourlyRate} />
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
