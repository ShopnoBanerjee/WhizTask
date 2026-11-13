'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { updateTask } from '@/lib/admin/actions'
import { toDateTimeInput } from '@/lib/dates'
import {
  type Client,
  type Department,
  type EmployeeWithDepartments,
  type TaskAttachment,
  type TaskWithRelations,
} from '@/types/database'
import {
  AttachmentList,
  DepartmentSelect,
  FieldLabel,
  SubtaskFields,
  UNASSIGNED,
  employeesInDepartment,
  newSubtaskDraft,
  pickValidFiles,
  subtaskToDraft,
  uploadFiles,
  validateSubtasks,
  type SubtaskDraft,
} from './task-form-shared'

interface EditTaskFormProps {
  task: TaskWithRelations
  clients: Client[]
  employees: EmployeeWithDepartments[]
  orgId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskUpdated?: (task: TaskWithRelations) => void
}

export function EditTaskForm({ task, clients, employees, orgId, open, onOpenChange, onTaskUpdated }: EditTaskFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clientId, setClientId] = useState(task.client_id)
  const [details, setDetails] = useState(task.details || '')
  const [existingAttachments, setExistingAttachments] = useState<TaskAttachment[]>(task.attachments || [])
  const [files, setFiles] = useState<File[]>([])

  const [department, setDepartment] = useState<Department>(task.department)
  const [assignee, setAssignee] = useState(task.assigned_to ?? UNASSIGNED)
  const [deadline, setDeadline] = useState(toDateTimeInput(task.deadline))

  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>(task.subtasks?.map(subtaskToDraft) || [])

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset the form when a different task is opened
  useEffect(() => {
    setClientId(task.client_id)
    setDetails(task.details || '')
    setExistingAttachments(task.attachments || [])
    setFiles([])
    setDepartment(task.department)
    setAssignee(task.assigned_to ?? UNASSIGNED)
    setDeadline(toDateTimeInput(task.deadline))
    setSubtasks(task.subtasks?.map(subtaskToDraft) || [])
    setError(null)
  }, [task])

  function updateSubtask(index: number, updates: Partial<SubtaskDraft>) {
    setSubtasks((prev) => prev.map((st, i) => (i === index ? { ...st, ...updates } : st)))
  }

  function addSubtask() {
    setSubtasks((prev) =>
      prev.length > 0
        ? [...prev, newSubtaskDraft(prev[prev.length - 1])]
        // Converting a single task: start from its department and deadline
        : [{ ...newSubtaskDraft(), department, deadline }]
    )
  }

  const hasSubtasks = subtasks.length > 0

  async function handleSubmit() {
    if (!clientId) return setError('Please select a client')

    if (hasSubtasks) {
      const subtaskError = validateSubtasks(subtasks)
      if (subtaskError) return setError(subtaskError)
    } else {
      if (!department) return setError('Please select a department')
      if (!deadline || isNaN(new Date(deadline).getTime())) return setError('Please set a deadline')
    }

    const hasFiles = files.length > 0 || subtasks.some((st) => st.files.length > 0)
    if (hasFiles && !orgId) return setError('Organization not loaded yet. Please try again.')

    setLoading(true)
    setError(null)

    try {
      const [uploaded, subtaskUploads] = await Promise.all([
        uploadFiles(orgId!, task.id, files),
        Promise.all(subtasks.map((st, i) => uploadFiles(orgId!, `${task.id}-subtask-${i}`, st.files))),
      ])

      const formData = new FormData()
      formData.set('client_id', clientId)
      formData.set('details', details)
      formData.set('attachments', JSON.stringify([...existingAttachments, ...uploaded]))

      if (hasSubtasks) {
        const subtasksData = subtasks.map((st, i) => ({
          id: st.id, // existing subtasks are updated, the rest created
          title: st.title.trim(),
          details: st.details,
          department: st.department,
          assigned_to: st.assigned_to,
          deadline: new Date(st.deadline).toISOString(),
          attachments: [...st.existingAttachments, ...subtaskUploads[i]],
        }))
        const latest = subtasksData.reduce((max, st) => (st.deadline > max ? st.deadline : max), subtasksData[0].deadline)

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

      const result = await updateTask(task.id, formData)

      if (result.error) {
        setError(result.error)
      } else {
        onOpenChange(false)
        if (onTaskUpdated && result.task) onTaskUpdated(result.task)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task')
    } finally {
      setLoading(false)
    }
  }

  const assignable = employeesInDepartment(employees, department, task.assigned_to ?? undefined)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
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
                <SelectValue placeholder="Choose a client" />
              </SelectTrigger>
              <SelectContent>
                {/* Keep the current client visible even before the list loads */}
                {!clients.some((c) => c.id === task.client_id) && task.client && (
                  <SelectItem value={task.client_id}>{task.client.name}</SelectItem>
                )}
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="edit-task-details">Details</FieldLabel>
            <Textarea
              id="edit-task-details"
              placeholder="What needs to be done?"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
            />
          </div>

          {hasSubtasks ? (
            <div className="space-y-2">
              <FieldLabel>Subtasks</FieldLabel>
              {subtasks.map((st, i) => (
                <SubtaskFields
                  key={st.id ?? `new-${i}`}
                  index={i}
                  subtask={st}
                  employees={employees}
                  onChange={(updates) => updateSubtask(i, updates)}
                  onRemove={() => setSubtasks((prev) => prev.filter((_, idx) => idx !== i))}
                  onError={setError}
                />
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addSubtask}>
                <Plus className="mr-1 size-4" />
                Add subtask
              </Button>
            </div>
          ) : (
            <>
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
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      {/* Keep the current assignee visible even before the list loads */}
                      {task.assigned_to && task.assigned_employee && !assignable.some((e) => e.id === task.assigned_to) && (
                        <SelectItem value={task.assigned_to}>
                          {task.assigned_employee.name || task.assigned_employee.email}
                        </SelectItem>
                      )}
                      {assignable.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name || emp.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="edit-task-deadline">Deadline *</FieldLabel>
                  <Input
                    id="edit-task-deadline"
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              </div>

              <Button type="button" variant="outline" size="sm" onClick={addSubtask}>
                <Plus className="mr-1 size-4" />
                Split into subtasks
              </Button>
            </>
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
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 size-4" />
              Attach files
            </Button>
            <AttachmentList
              existing={existingAttachments}
              files={files}
              onRemoveExisting={(i) => setExistingAttachments((prev) => prev.filter((_, idx) => idx !== i))}
              onRemoveFile={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
