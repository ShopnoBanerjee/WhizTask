'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Plus, Upload } from 'lucide-react'
import { createOwnTask } from '@/lib/employee/actions'
import { formatFileSize } from '@/lib/supabase/storage'
import { DEPARTMENTS, MAX_FILE_SIZE, type Client, type Department } from '@/types/database'
import {
  AttachmentList,
  FieldLabel,
  defaultDeadline,
  pickValidFiles,
  uploadFiles,
} from '@/components/admin/task-form-shared'

interface AddOwnTaskFormProps {
  clients: Client[]
  departments: Department[] // the employee's own departments
  orgId: string | null
  onTaskCreated?: () => void
}

// Lets anyone with a My Tasks page add a task for themselves. There is no assignee field:
// the server always assigns the task to the signed-in user.
export function AddOwnTaskForm({ clients, departments, orgId, onTaskCreated }: AddOwnTaskFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onlyDepartment = departments.length === 1 ? departments[0] : ''
  const [clientId, setClientId] = useState('')
  const [details, setDetails] = useState('')
  const [department, setDepartment] = useState<Department | ''>(onlyDepartment)
  const [deadline, setDeadline] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    setClientId('')
    setDetails('')
    setDepartment(onlyDepartment)
    setDeadline(defaultDeadline())
    setFiles([])
    setError(null)
  }

  async function handleSubmit() {
    if (!clientId) return setError('Please select a client')
    if (!department) return setError('Please select a department')
    if (!deadline || isNaN(new Date(deadline).getTime())) return setError('Please set a deadline')
    if (files.length > 0 && !orgId) return setError('Organization not loaded yet. Please try again.')

    setLoading(true)
    setError(null)

    try {
      const attachments = await uploadFiles(orgId!, crypto.randomUUID(), files)

      const formData = new FormData()
      formData.set('client_id', clientId)
      formData.set('details', details)
      formData.set('department', department)
      formData.set('deadline', new Date(deadline).toISOString())
      formData.set('attachments', JSON.stringify(attachments))

      const result = await createOwnTask(formData)

      if (result.error) {
        setError(result.error)
      } else {
        handleOpenChange(false)
        onTaskCreated?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add task')
    } finally {
      setLoading(false)
    }
  }

  const departmentOptions = DEPARTMENTS.filter((d) => departments.includes(d.value))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a task for yourself</DialogTitle>
          <DialogDescription>The task is assigned to you.</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel>Client *</FieldLabel>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={clients.length === 0 ? 'No clients yet' : 'Choose a client'} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="own-task-details">Details</FieldLabel>
            <Textarea
              id="own-task-details"
              placeholder="What needs to be done?"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Department *</FieldLabel>
              <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {departmentOptions.map((dept) => (
                    <SelectItem key={dept.value} value={dept.value}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="own-task-deadline">Deadline *</FieldLabel>
              <Input
                id="own-task-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = pickValidFiles(e.target.files)
                if (picked.error) setError(picked.error)
                setFiles((prev) => [...prev, ...picked.files])
                e.target.value = ''
              }}
            />
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 size-4" />
                Attach files
              </Button>
              <span className="text-xs text-muted-foreground">Up to {formatFileSize(MAX_FILE_SIZE)} each</span>
            </div>
            <AttachmentList
              files={files}
              onRemoveFile={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Task'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
