import { getClients } from '@/lib/admin/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CLIENT_TYPES } from '@/types/database'

export default async function ClientsPage() {
  const clients = await getClients()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clients</h1>
        <p className="text-muted-foreground">Manage your organization&apos;s clients</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <Card key={client.id}>
            <CardHeader>
              <CardTitle className="text-lg">{client.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">
                {CLIENT_TYPES.find((t) => t.value === client.type)?.label || client.type}
              </Badge>
            </CardContent>
          </Card>
        ))}

        {clients.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No clients found. Add your first client to get started.
          </div>
        )}
      </div>
    </div>
  )
}
