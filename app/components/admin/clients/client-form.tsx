'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Pencil } from 'lucide-react'
import { createClientFull, updateClientFull, getSoftwareWithSubscribers } from '@/lib/admin/client-actions'
import { CLIENT_TYPES, type ClientWithCalculations, type SoftwareWithSubscribers } from '@/types/database'

interface ClientFormProps {
  client?: ClientWithCalculations
  onSuccess?: () => void
}

export function ClientForm({ client, onSuccess }: ClientFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [software, setSoftware] = useState<SoftwareWithSubscribers[]>([])
  const [clientType, setClientType] = useState(client?.type || 'retainership')
  const [selectedSoftware, setSelectedSoftware] = useState<string[]>(
    client?.subscribed_software?.map(s => s.id) || []
  )

  const isEdit = !!client

  useEffect(() => {
    if (open) {
      loadSoftware()
    }
  }, [open])

  async function loadSoftware() {
    const data = await getSoftwareWithSubscribers()
    setSoftware(data)
  }

  function toggleSoftware(softwareId: string) {
    setSelectedSoftware(prev =>
      prev.includes(softwareId)
        ? prev.filter(id => id !== softwareId)
        : [...prev, softwareId]
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    selectedSoftware.forEach(id => formData.append('software_ids', id))

    const result = isEdit
      ? await updateClientFull(client.id, formData)
      : await createClientFull(formData)

    if (result.error) {
      setError(result.error)
    } else {
      setOpen(false)
      onSuccess?.()
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 size-4" />
            Add Client
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Client' : 'Add New Client'}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Client Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={client?.name}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={client?.contact?.email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={client?.contact?.phone}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              name="address"
              defaultValue={client?.contact?.address}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Client Type *</Label>
            <Select
              name="type"
              value={clientType}
              onValueChange={(v) => setClientType(v as 'retainership' | 'project_basis')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {clientType === 'retainership' ? (
            <div className="space-y-2">
              <Label htmlFor="monthly_value">Monthly Value (₹) *</Label>
              <Input
                id="monthly_value"
                name="monthly_value"
                type="number"
                min="0"
                step="0.01"
                defaultValue={client?.monthly_value || ''}
                required
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project_value">Project Value (₹) *</Label>
                <Input
                  id="project_value"
                  name="project_value"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={client?.project_value || ''}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project_duration_months">Duration (Months) *</Label>
                <Input
                  id="project_duration_months"
                  name="project_duration_months"
                  type="number"
                  min="1"
                  defaultValue={client?.project_duration_months || ''}
                  required
                />
              </div>
            </div>
          )}

          {software.length > 0 && (
            <div className="space-y-2">
              <Label>Software Subscriptions</Label>
              <div className="grid grid-cols-2 gap-2 rounded border p-3">
                {software.map((sw) => (
                  <div key={sw.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`sw-${sw.id}`}
                      checked={selectedSoftware.includes(sw.id)}
                      onCheckedChange={() => toggleSoftware(sw.id)}
                    />
                    <Label htmlFor={`sw-${sw.id}`} className="cursor-pointer text-sm">
                      {sw.name} (₹{sw.value_per_month}/mo)
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
