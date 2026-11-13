'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Plus, Upload } from 'lucide-react'
import { createTask } from '@/lib/admin/actions'
import { formatFileSize } from '@/lib/supabase/storage'
import {
  MAX_FILE_SIZE,
  type Client,
  type Department,
  type EmployeeWithDepartments,
  type TaskWithRelations,
} from '@/types/database'
import {
  AttachmentList,
  DepartmentSelect,
  FieldLabel,
  SubtaskFields,
  UNASSIGNED,
  defaultDeadline,
  employeesInDepartment,
  newSubtaskDraft,
  pickValidFiles,
  uploadFiles,
  validateSubtasks,
  type SubtaskDraft,
} from './task-form-shared'

interface CreateTaskFormProps {
  clients: Client[]
  employees: EmployeeWithDepartments[]
  orgId: string | null
  onTaskCreated?: (task: TaskWithRelations) => void
}

// One screen instead of a six-step wizard. Clients and employees arrive as
// props (already loaded by the page), so opening the dialog and picking a
// department need no server round trips.
export function CreateTaskForm({ clients, employees, orgId, onTaskCreated }: CreateTaskFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clientId, setClientId] = useState('')
  const [details, setDetails] = useState('')
  const [files, setFiles] = useState<File[]>([])

  // Single-assignee mode
  const [department, setDepartment] = useState<Department | ''>('')
  const [assignee, setAssignee] = useState(UNASSIGNED)
  const [deadline, setDeadline] = useState('')

  // Subtask mode
  const [split, setSplit] = useState(false)
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetForm() {
    setClientId('')
    setDetails('')
    setFiles([])
    setDepartment('')
    setAssignee(UNASSIGNED)
    setDeadline(defaultDeadline())
    setSplit(false)
    setSubtasks([])
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    resetForm()
  }

  function handleSplitChange(next: boolean) {
    setSplit(next)
    if (next && subtasks.length === 0) {
      // Carry over what was already entered for the single task
      setSubtasks([{ ...newSubtaskDraft(), department, deadline: deadline || defaultDeadline() }])
    }
  }

  function updateSubtask(index: number, updates: Partial<SubtaskDraft>) {
    setSubtasks((prev) => prev.map((st, i) => (i === index ? { ...st, ...updates } : st)))
  }

  async function handleSubmit() {
    if (!clientId) return setError('Please select a client')

    if (split) {
      if (subtasks.length === 0) return setError('Please add at least one subtask')
      const subtaskError = validateSubtasks(subtasks)
      if (subtaskError) return setError(subtaskError)
    } else {
      if (!department) return setError('Please select a department')
      if (!deadline || isNaN(new Date(deadline).getTime())) return setError('Please set a deadline')
    }

    const hasFiles = files.length > 0 || (split && subtasks.some((st) => st.files.length > 0))
    if (hasFiles && !orgId) return setError('Organization not loaded yet. Please try again.')

    setLoading(true)
    setError(null)

    try {
      const folder = crypto.randomUUID()

      // All uploads (task + every subtask) run at the same time
      const [attachments, subtaskAttachments] = await Promise.all([
        uploadFiles(orgId!, folder, files),
        Promise.all(
          split
            ? subtasks.map((st, i) => uploadFiles(orgId!, `${folder}-subtask-${i}`, st.files))
            : []
        ),
      ])

      const formData = new FormData()
      formData.set('client_id', clientId)
      formData.set('details', details)
      formData.set('attachments', JSON.stringify(attachments))

      if (split) {
        const subtasksData = subtasks.map((st, i) => ({
          title: st.title.trim(),
          details: st.details,
          department: st.department,
          assigned_to: st.assigned_to,
          deadline: new Date(st.deadline).toISOString(),
          attachments: subtaskAttachments[i],
        }))
        const latest = subtasksData.reduce((max, st) => (st.deadline > max ? st.deadline : max), subtasksData[0].deadline)

        // The parent takes its department from the first subtask and its
        // deadline from the latest one; it has no assignee of its own
        formData.set('department', subtasksData[0].department)
        formData.set('assigned_to', '')
        formData.set('deadline', latest)
        formData.set('subtasks', JSON.stringify(subtasksData))
      } else {
        formData.set('department', department)
        formData.set('assigned_to', assignee === UNASSIGNED ? '' : assignee)
        formData.set('deadline', new Date(deadline).toISOString())
        formData.set('subtasks', JSON.stringify([]))
      }

      const result = await createTask(formData)

      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        resetForm()
        if (onTaskCreated && result.task) onTaskCreated(result.task)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  const assignable = employeesInDepartment(employees, department)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Create Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
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
            <FieldLabel htmlFor="task-details">Details</FieldLabel>
            <Textarea
              id="task-details"
              placeholder="What needs to be done?"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch id="split-task" checked={split} onCheckedChange={handleSplitChange} />
            <Label htmlFor="split-task" className="text-sm font-normal">
              Split into subtasks for several people
            </Label>
          </div>

          {split ? (
            <div className="space-y-2">
              {subtasks.map((st, i) => (
                <SubtaskFields
                  key={i}
                  index={i}
                  subtask={st}
                  employees={employees}
                  onChange={(updates) => updateSubtask(i, updates)}
                  onRemove={() => setSubtasks((prev) => prev.filter((_, idx) => idx !== i))}
                  onError={setError}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSubtasks((prev) => [...prev, newSubtaskDraft(prev[prev.length - 1])])}
              >
                <Plus className="mr-1 size-4" />
                Add subtask
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <FieldLabel>Department *</FieldLabel>
                <DepartmentSelect
                  value={department}
                  onChange={(d) => {
                    setDepartment(d)
                    setAssignee(UNASSIGNED)
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Assign to</FieldLabel>
                <Select value={assignee} onValueChange={setAssignee} disabled={!department}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {assignable.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name || emp.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="task-deadline">Deadline *</FieldLabel>
                <Input
                  id="task-deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              {department && assignable.length === 0 && (
                <p className="text-xs text-muted-foreground sm:col-span-3">
                  No employees in this department yet. The task can stay unassigned.
                </p>
              )}
            </div>
          )}

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
              <span className="text-xs text-muted-foreground">
                Up to {formatFileSize(MAX_FILE_SIZE)} each
              </span>
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
                  Creating...
                </>
              ) : (
                'Create Task'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
