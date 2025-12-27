'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Pencil } from 'lucide-react'
import { createSoftware, updateSoftware, getClientsWithCalculations } from '@/lib/admin/client-actions'
import type { SoftwareWithSubscribers, ClientWithCalculations } from '@/types/database'

interface SoftwareFormProps {
  software?: SoftwareWithSubscribers
}

export function SoftwareForm({ software }: SoftwareFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [clients, setClients] = useState<ClientWithCalculations[]>([])
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])
  const [loadingClients, setLoadingClients] = useState(false)

  useEffect(() => {
    if (open) {
      setLoadingClients(true)
      getClientsWithCalculations().then((res) => {
        setClients(res)
        setLoadingClients(false)
      })
      setSelectedClientIds(software?.subscribers.map(c => c.id) || [])
    }
  }, [open, software])

  function toggleClient(clientId: string) {
    setSelectedClientIds(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    )
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    
    // Add selected client IDs to form data
    selectedClientIds.forEach(id => {
      formData.append('client_ids', id)
    })

    startTransition(async () => {
      const result = software
        ? await updateSoftware(software.id, formData)
        : await createSoftware(formData)

      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {software ? (
          <button className="flex w-full items-center px-2 py-1.5 text-sm">
            <Pencil className="mr-2 size-4" />
            Edit
          </button>
        ) : (
          <Button>
            <Plus className="mr-2 size-4" />
            Add Software
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{software ? 'Edit Software' : 'Add Software'}</DialogTitle>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Software Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={software?.name || ''}
              placeholder="e.g., Figma, Slack, GitHub"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="value_per_month">Monthly Cost (₹)</Label>
            <Input
              id="value_per_month"
              name="value_per_month"
              type="number"
              step="0.01"
              min="0"
              defaultValue={software?.value_per_month || ''}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Subscribed by Clients</Label>
            <ScrollArea className="h-40 rounded border p-2">
              {loadingClients ? (
                <p className="text-sm text-muted-foreground">Loading clients...</p>
              ) : clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">No clients available</p>
              ) : (
                <div className="space-y-2">
                  {clients.map((client) => (
                    <div key={client.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`client-${client.id}`}
                        checked={selectedClientIds.includes(client.id)}
                        onCheckedChange={() => toggleClient(client.id)}
                      />
                      <Label htmlFor={`client-${client.id}`} className="text-sm font-normal cursor-pointer">
                        {client.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            {selectedClientIds.length > 0 && software?.value_per_month && (
              <p className="text-xs text-muted-foreground">
                Cost per client: ₹{(software.value_per_month / selectedClientIds.length).toFixed(2)}/month
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : software ? 'Update' : 'Add Software'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
