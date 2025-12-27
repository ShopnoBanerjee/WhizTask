import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import {
  getClientsWithCalculations,
  getSoftwareWithSubscribers,
  getOverheads,
  getAuditLogs,
  getFinancialSummary,
} from '@/lib/admin/client-actions'
import { ClientList } from '@/components/admin/clients/client-list'
import { ClientForm } from '@/components/admin/clients/client-form'
import { SoftwareList } from '@/components/admin/clients/software-list'
import { SoftwareForm } from '@/components/admin/clients/software-form'
import { OverheadForm } from '@/components/admin/clients/overhead-form'
import { AuditLogViewer } from '@/components/admin/clients/audit-log-viewer'

export default async function ClientsPage() {
  const [
    clients,
    software,
    overheads,
    logs,
    summary,
  ] = await Promise.all([
    getClientsWithCalculations(),
    getSoftwareWithSubscribers(),
    getOverheads(),
    getAuditLogs(),
    getFinancialSummary(),
  ])

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
      <div>
        <h1 className="text-2xl font-bold">Clients &amp; Finance</h1>
        <p className="text-muted-foreground">Manage clients, subscriptions, and overhead costs</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Clients</p>
              <p className="text-2xl font-bold">{summary.clientCount}</p>
              <p className="text-xs text-muted-foreground">
                {summary.retainershipCount} retainership, {summary.projectCount} project
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Monthly Revenue</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalMonthlyRevenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Monthly Costs</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(summary.totalSoftwareCost + summary.totalOverheadCost)}
              </p>
              <p className="text-xs text-muted-foreground">
                Software: {formatCurrency(summary.totalSoftwareCost)} | Overhead: {formatCurrency(summary.totalOverheadCost)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Net Monthly</p>
              <p className={`text-2xl font-bold ${summary.totalNetRevenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(summary.totalNetRevenue)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabbed Interface */}
      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clients">Clients ({clients?.length || 0})</TabsTrigger>
          <TabsTrigger value="software">Software ({software?.length || 0})</TabsTrigger>
          <TabsTrigger value="overheads">Overheads</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-4">
          <div className="flex justify-end">
            <ClientForm />
          </div>
          <ClientList clients={clients} />
        </TabsContent>

        <TabsContent value="software" className="space-y-4">
          <div className="flex justify-end">
            <SoftwareForm />
          </div>
          <SoftwareList software={software} />
        </TabsContent>

        <TabsContent value="overheads" className="space-y-4">
          <OverheadForm overheads={overheads} />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditLogViewer logs={logs} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
