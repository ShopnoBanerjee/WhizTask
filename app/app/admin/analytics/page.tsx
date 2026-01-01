import { format, subDays } from 'date-fns'
import { AnalyticsDashboard } from '@/components/admin/analytics/analytics-dashboard'
import {
  getAnalyticsSummary,
  getEmployeeHourlyRates,
  getClientManHours,
  getClientProfitability,
  getEmployeePerformance,
} from '@/lib/admin/analytics-actions'

export default async function AnalyticsPage() {
  // Default to last 30 days
  const endDate = new Date()
  const startDate = subDays(endDate, 30)
  
  const startStr = format(startDate, 'yyyy-MM-dd')
  const endStr = format(endDate, 'yyyy-MM-dd')

  // Fetch all analytics data in parallel
  const [summary, employeeRates, clientHours, clientProfitability, employeePerformance] = 
    await Promise.all([
      getAnalyticsSummary(startStr, endStr),
      getEmployeeHourlyRates(),
      getClientManHours(startStr, endStr),
      getClientProfitability(startStr, endStr),
      getEmployeePerformance(startStr, endStr),
    ])

  return (
    <AnalyticsDashboard
      initialData={{
        summary,
        employeeRates,
        clientHours,
        clientProfitability,
        employeePerformance,
      }}
      startDate={startStr}
      endDate={endStr}
    />
  )
}
