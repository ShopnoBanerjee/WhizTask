'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'
import type { ClientProfitability } from '@/types/database'

interface ClientProfitabilityChartProps {
  data: ClientProfitability[]
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)

const formatCompact = (value: number) => {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value.toFixed(0)}`
}

export function ClientProfitabilityChart({ data }: ClientProfitabilityChartProps) {
  const [view, setView] = useState<'profit' | 'breakdown'>('profit')

  const chartData = data.slice(0, 10).map(client => ({
    name: client.clientName.length > 12 
      ? client.clientName.substring(0, 12) + '...' 
      : client.clientName,
    fullName: client.clientName,
    type: client.clientType,
    revenue: client.totalRevenue,
    laborCost: client.laborCost,
    softwareCost: client.softwareCost,
    overheadCost: client.overheadCost,
    totalCost: client.totalCost,
    profit: client.grossProfit,
    margin: client.profitMargin,
    hours: client.totalHours,
  }))

  const totalProfit = data.reduce((sum, c) => sum + c.grossProfit, 0)
  const avgMargin = data.length > 0
    ? data.reduce((sum, c) => sum + c.profitMargin, 0) / data.length
    : 0

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Client Profitability</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No client data available
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">Client Profitability</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Net Profit: <span className={totalProfit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {formatCurrency(totalProfit)}
              </span>
              <span className="mx-2">•</span>
              Avg Margin: <span className="font-medium">{avgMargin.toFixed(1)}%</span>
            </p>
          </div>
          <div className="flex gap-1">
            <Button 
              variant={view === 'profit' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setView('profit')}
            >
              Profit
            </Button>
            <Button 
              variant={view === 'breakdown' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setView('breakdown')}
            >
              Cost Breakdown
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            {view === 'profit' ? (
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatCompact} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.[0]) return null
                    const data = payload[0].payload
                    return (
                      <div className="bg-popover border rounded-lg shadow-lg p-3 space-y-1">
                        <p className="font-medium">{data.fullName}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {data.type.replace('_', ' ')}
                        </p>
                        <div className="border-t pt-2 mt-2 space-y-1">
                          <p className="text-sm">Revenue: {formatCurrency(data.revenue)}</p>
                          <p className="text-sm">Cost: {formatCurrency(data.totalCost)}</p>
                          <p className={`font-bold ${data.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            Profit: {formatCurrency(data.profit)}
                          </p>
                          <p className="text-sm">Margin: {data.margin.toFixed(1)}%</p>
                        </div>
                      </div>
                    )
                  }}
                />
                <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                <Bar 
                  dataKey="profit" 
                  name="Profit"
                  radius={[4, 4, 0, 0]}
                  fill="#10b981"
                />
              </BarChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatCompact} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const data = payload[0].payload
                    return (
                      <div className="bg-popover border rounded-lg shadow-lg p-3 space-y-1">
                        <p className="font-medium">{data.fullName}</p>
                        <div className="border-t pt-2 mt-2 space-y-1">
                          <p className="text-sm">Revenue: <span className="font-medium text-green-600">{formatCurrency(data.revenue)}</span></p>
                          <p className="text-sm">Labor: {formatCurrency(data.laborCost)}</p>
                          <p className="text-sm">Software: {formatCurrency(data.softwareCost)}</p>
                          <p className="text-sm">Overhead: {formatCurrency(data.overheadCost)}</p>
                          <p className="text-sm font-medium">Total Cost: {formatCurrency(data.totalCost)}</p>
                        </div>
                      </div>
                    )
                  }}
                />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" stackId="a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="laborCost" name="Labor" fill="#ef4444" stackId="b" />
                <Bar dataKey="softwareCost" name="Software" fill="#f59e0b" stackId="b" />
                <Bar dataKey="overheadCost" name="Overhead" fill="#8b5cf6" stackId="b" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {data.length > 10 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Showing top 10 of {data.length} clients by profit
          </p>
        )}
      </CardContent>
    </Card>
  )
}
