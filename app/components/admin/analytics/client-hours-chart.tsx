'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { ClientManHours } from '@/types/database'
import { TASK_COLORS } from '@/types/database'

interface ClientHoursChartProps {
  data: ClientManHours[]
}

export function ClientHoursChart({ data }: ClientHoursChartProps) {
  const chartData = data.slice(0, 10).map((client, index) => ({
    name: client.clientName.length > 15 
      ? client.clientName.substring(0, 15) + '...' 
      : client.clientName,
    fullName: client.clientName,
    hours: client.totalHours,
    type: client.clientType,
    color: TASK_COLORS[index % TASK_COLORS.length],
  }))

  const totalHours = data.reduce((sum, c) => sum + c.totalHours, 0)

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Man Hours by Client</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No time logged in this period
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Man Hours by Client</CardTitle>
          <Badge variant="secondary">{totalHours.toFixed(1)} hrs total</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
            >
              <XAxis type="number" tickFormatter={(v: number) => `${v}h`} />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={100}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                content={({ active, payload }: { active?: boolean; payload?: readonly any[] }) => {
                  if (!active || !payload?.[0]) return null
                  const data = payload[0].payload as typeof chartData[0]
                  return (
                    <div className="bg-popover border rounded-lg shadow-lg p-3">
                      <p className="font-medium">{data.fullName}</p>
                      <p className="text-sm text-muted-foreground capitalize">{data.type.replace('_', ' ')}</p>
                      <p className="text-lg font-bold mt-1">{data.hours.toFixed(1)} hours</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {data.length > 10 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Showing top 10 of {data.length} clients
          </p>
        )}
      </CardContent>
    </Card>
  )
}
