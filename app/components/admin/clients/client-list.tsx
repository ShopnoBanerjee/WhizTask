'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MoreVertical, Trash2 } from 'lucide-react'
import { deleteClientFull } from '@/lib/admin/client-actions'
import { ClientForm } from './client-form'
import { CLIENT_TYPES, type ClientWithCalculations } from '@/types/database'

interface ClientListProps {
  clients: ClientWithCalculations[]
}

export function ClientList({ clients }: ClientListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    await deleteClientFull(deleteId)
    setDeleteId(null)
    setDeleting(false)
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground mb-4">No clients found</p>
        <ClientForm />
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <Card key={client.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{client.name}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <ClientForm client={client} />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteId(client.id)}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Badge variant="secondary">
                {CLIENT_TYPES.find(t => t.value === client.type)?.label}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {client.contact?.email && (
                <p className="text-sm text-muted-foreground">{client.contact.email}</p>
              )}

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Value</span>
                  <span className="font-medium">{formatCurrency(client.effective_monthly_value)}</span>
                </div>

                {client.type === 'project_basis' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Project Total</span>
                    <span>{formatCurrency(client.project_value || 0)} / {client.project_duration_months} mo</span>
                  </div>
                )}

                {client.software_cost > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Software Cost</span>
                    <span>-{formatCurrency(client.software_cost)}</span>
                  </div>
                )}

                {client.overhead_cost > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Overhead Cost</span>
                    <span>-{formatCurrency(client.overhead_cost)}</span>
                  </div>
                )}

                <div className="flex justify-between border-t pt-1 font-medium">
                  <span>Net Value</span>
                  <span className={client.net_value >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(client.net_value)}
                  </span>
                </div>
              </div>

              {client.subscribed_software.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {client.subscribed_software.map((sw) => (
                    <Badge key={sw.id} variant="outline" className="text-xs">
                      {sw.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this client? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
