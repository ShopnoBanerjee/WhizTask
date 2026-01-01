import { NextRequest, NextResponse } from 'next/server'
import {
  getAnalyticsSummary,
  getEmployeeHourlyRates,
  getClientManHours,
  getClientProfitability,
  getEmployeePerformance,
} from '@/lib/admin/analytics-actions'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Missing date parameters' }, { status: 400 })
  }

  try {
    const [summary, employeeRates, clientHours, clientProfitability, employeePerformance] = 
      await Promise.all([
        getAnalyticsSummary(startDate, endDate),
        getEmployeeHourlyRates(),
        getClientManHours(startDate, endDate),
        getClientProfitability(startDate, endDate),
        getEmployeePerformance(startDate, endDate),
      ])

    return NextResponse.json({
      summary,
      employeeRates,
      clientHours,
      clientProfitability,
      employeePerformance,
    })
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
