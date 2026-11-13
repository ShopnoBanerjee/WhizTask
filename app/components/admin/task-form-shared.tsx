'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Paperclip, Trash2, Upload, X } from 'lucide-react'
import { uploadTaskAttachment, validateFileSize, formatFileSize } from '@/lib/supabase/storage'
import { toDateTimeInput } from '@/lib/dates'
import {
  DEPARTMENTS,
  MAX_FILE_SIZE,
  type Department,
  type EmployeeWithDepartments,
  type SubtaskWithRelations,
  type TaskAttachment,
} from '@/types/database'

// Pieces shared by the create and edit task dialogs.

export const UNASSIGNED = 'unassigned'

export interface SubtaskDraft {
  id?: string // set for subtasks that already exist
  title: string
  details: string
  department: Department | ''
  assigned_to: string
  deadline: string // <input type="datetime-local"> value, local time
  existingAttachments: TaskAttachment[]
  files: File[]
}

// Deadline suggested for new work: 6pm today, local time
export function defaultDeadline(): string {
  const d = new Date()
  d.setHours(18, 0, 0, 0)
  return toDateTimeInput(d)
}

// A new subtask starts from the previous one's department and deadline, since
// consecutive subtasks usually share them.
export function newSubtaskDraft(previous?: SubtaskDraft): SubtaskDraft {
  return {
    title: '',
    details: '',
    department: previous?.department ?? '',
    assigned_to: '',
    deadline: previous?.deadline || defaultDeadline(),
    existingAttachments: [],
    files: [],
  }
}

export function subtaskToDraft(subtask: SubtaskWithRelations): SubtaskDraft {
  return {
    id: subtask.id,
    title: subtask.title,
    details: subtask.details || '',
    department: subtask.department,
    assigned_to: subtask.assigned_to || '',
    deadline: toDateTimeInput(subtask.deadline),
    existingAttachments: subtask.attachments || [],
    files: [],
  }
}

// Employees are loaded once with their departments, so picking a department
// filters this list in memory instead of asking the server each time.
// `keepId` keeps the current assignee selectable even if they have since left
// the department.
export function employeesInDepartment(
  employees: EmployeeWithDepartments[],
  department: Department | '',
  keepId?: string
): EmployeeWithDepartments[] {
  if (!department) return []
  return employees.filter((e) => e.departments.includes(department) || e.id === keepId)
}

export function validateSubtasks(subtasks: SubtaskDraft[]): string | null {
  for (let i = 0; i < subtasks.length; i++) {
    const st = subtasks[i]
    if (!st.title.trim()) return `Subtask ${i + 1}: Title is required`
    if (!st.department) return `Subtask ${i + 1}: Department is required`
    if (!st.assigned_to) return `Subtask ${i + 1}: Employee assignment is required`
    if (!st.deadline || isNaN(new Date(st.deadline).getTime())) {
      return `Subtask ${i + 1}: Deadline is required`
    }
  }
  return null
}

// Splits picked files into those within the size limit and an error message
export function pickValidFiles(fileList: FileList | null): { files: File[]; error: string | null } {
  const files: File[] = []
  let error: string | null = null
  for (const file of Array.from(fileList || [])) {
    if (validateFileSize(file)) files.push(file)
    else error = `File "${file.name}" exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`
  }
  return { files, error }
}

// Uploads run together rather than one after another
export async function uploadFiles(orgId: string, folder: string, files: File[]): Promise<TaskAttachment[]> {
  const results = await Promise.all(files.map((file) => uploadTaskAttachment(orgId, folder, file)))
  const failed = results.filter((r) => r === null).length
  if (failed > 0) {
    throw new Error(`${failed} file${failed === 1 ? '' : 's'} failed to upload. Please try again.`)
  }
  return results as TaskAttachment[]
}

interface FileListProps {
  existing?: TaskAttachment[]
  files: File[]
  onRemoveExisting?: (index: number) => void
  onRemoveFile: (index: number) => void
}

export function AttachmentList({ existing = [], files, onRemoveExisting, onRemoveFile }: FileListProps) {
  if (existing.length === 0 && files.length === 0) return null
  return (
    <div className="space-y-1">
      {existing.map((att, i) => (
        <div key={`existing-${i}`} className="flex items-center justify-between rounded border px-2 py-1 text-xs bg-muted/50">
          <span className="truncate flex items-center gap-1">
            <Paperclip className="size-3 shrink-0" />
            {att.name}
          </span>
          {onRemoveExisting && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              aria-label={`Remove ${att.name}`}
              onClick={() => onRemoveExisting(i)}
            >
              <X className="size-3" />
            </Button>
          )}
        </div>
      ))}
      {files.map((file, i) => (
        <div key={`new-${i}`} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
          <span className="truncate">{file.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            aria-label={`Remove ${file.name}`}
            onClick={() => onRemoveFile(i)}
          >
            <X className="size-3" />
          </Button>
        </div>
      ))}
    </div>
  )
}

interface DepartmentSelectProps {
  value: Department | ''
  onChange: (department: Department) => void
}

export function DepartmentSelect({ value, onChange }: DepartmentSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Department)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Department" />
      </SelectTrigger>
      <SelectContent>
        {DEPARTMENTS.map((dept) => (
          <SelectItem key={dept.value} value={dept.value}>
            {dept.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface SubtaskFieldsProps {
  index: number
  subtask: SubtaskDraft
  employees: EmployeeWithDepartments[]
  onChange: (updates: Partial<SubtaskDraft>) => void
  onRemove: () => void
  onError: (message: string) => void
}

export function SubtaskFields({ index, subtask, employees, onChange, onRemove, onError }: SubtaskFieldsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const options = employeesInDepartment(employees, subtask.department, subtask.assigned_to)

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground w-5 shrink-0">{index + 1}.</span>
        <Input
          placeholder="Subtask title *"
          aria-label={`Subtask ${index + 1} title`}
          value={subtask.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={`Remove subtask ${index + 1}`}
          onClick={onRemove}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <DepartmentSelect
          value={subtask.department}
          onChange={(department) => onChange({ department, assigned_to: '' })}
        />
        <Select
          value={subtask.assigned_to}
          onValueChange={(v) => onChange({ assigned_to: v })}
          disabled={!subtask.department}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={
                !subtask.department ? 'Pick department first'
                  : options.length === 0 ? 'No one in department'
                  : 'Assign to *'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {options.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.name || emp.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="datetime-local"
          aria-label={`Subtask ${index + 1} deadline`}
          value={subtask.deadline}
          onChange={(e) => onChange({ deadline: e.target.value })}
        />
      </div>

      <div className="flex items-start gap-2">
        <Textarea
          placeholder="Details (optional)"
          aria-label={`Subtask ${index + 1} details`}
          value={subtask.details}
          onChange={(e) => onChange({ details: e.target.value })}
          rows={1}
          className="min-h-9 text-sm"
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const { files, error } = pickValidFiles(e.target.files)
            if (error) onError(error)
            if (files.length > 0) onChange({ files: [...subtask.files, ...files] })
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 shrink-0"
          aria-label={`Attach files to subtask ${index + 1}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-4" />
        </Button>
      </div>

      <AttachmentList
        existing={subtask.existingAttachments}
        files={subtask.files}
        onRemoveExisting={(i) =>
          onChange({ existingAttachments: subtask.existingAttachments.filter((_, idx) => idx !== i) })
        }
        onRemoveFile={(i) => onChange({ files: subtask.files.filter((_, idx) => idx !== i) })}
      />
    </div>
  )
}

interface FieldLabelProps {
  children: React.ReactNode
  htmlFor?: string
}

export function FieldLabel({ children, htmlFor }: FieldLabelProps) {
  return (
    <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
      {children}
    </Label>
  )
}
