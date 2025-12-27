'use client'

import { useState, useEffect, useRef } from 'react'
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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { format } from 'date-fns'
import { CalendarIcon, Plus, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createTask, getClients, getEmployeesByDepartment } from '@/lib/admin/actions'
import { uploadTaskAttachment, validateFileSize, formatFileSize } from '@/lib/supabase/storage'
import { DEPARTMENTS, MAX_FILE_SIZE, type Client, type Department, type EmployeeWithDepartments, type TaskAttachment } from '@/types/database'

export function CreateTaskForm() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [clients, setClients] = useState<Client[]>([])
  const [employees, setEmployees] = useState<EmployeeWithDepartments[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [selectedDepartment, setSelectedDepartment] = useState<Department | ''>('')
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [deadline, setDeadline] = useState<Date>()
  const [details, setDetails] = useState('')
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      loadClients()
    }
  }, [open])

  useEffect(() => {
    if (selectedDepartment) {
      loadEmployees(selectedDepartment)
    }
  }, [selectedDepartment])

  async function loadClients() {
    const data = await getClients()
    setClients(data)
  }

  async function loadEmployees(department: Department) {
    const data = await getEmployeesByDepartment(department)
    setEmployees(data)
  }

  function resetForm() {
    setStep(1)
    setSelectedClient('')
    setSelectedDepartment('')
    setSelectedEmployee('')
    setDeadline(undefined)
    setDetails('')
    setAttachments([])
    setUploadingFiles([])
    setError(null)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const validFiles: File[] = []
    
    for (const file of files) {
      if (!validateFileSize(file)) {
        setError(`File "${file.name}" exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`)
        continue
      }
      validFiles.push(file)
    }

    setUploadingFiles(prev => [...prev, ...validFiles])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function removeUploadingFile(index: number) {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (!selectedClient || !selectedDepartment || !deadline) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Create a temporary task ID for file uploads
      const tempTaskId = crypto.randomUUID()

      // Upload all pending files
      const uploadedAttachments: TaskAttachment[] = [...attachments]
      
      for (const file of uploadingFiles) {
        const result = await uploadTaskAttachment(
          '', // org_id will be determined server-side
          tempTaskId,
          file
        )
        if (result) {
          uploadedAttachments.push(result)
        }
      }

      const formData = new FormData()
      formData.set('client_id', selectedClient)
      formData.set('department', selectedDepartment)
      formData.set('assigned_to', selectedEmployee)
      formData.set('deadline', deadline.toISOString())
      formData.set('details', details)
      formData.set('attachments', JSON.stringify(uploadedAttachments))

      const result = await createTask(formData)

      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        resetForm()
      }
    } catch (err) {
      setError('Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1: return !!selectedClient
      case 2: return !!selectedDepartment
      case 3: return true // Employee is optional
      case 4: return !!deadline
      default: return true
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm() }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Create Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Task - Step {step}/5</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {step === 1 && (
            <div className="space-y-2">
              <Label>Select Client *</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a client" />
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
          )}

          {step === 2 && (
            <div className="space-y-2">
              <Label>Select Department *</Label>
              <Select value={selectedDepartment} onValueChange={(v) => setSelectedDepartment(v as Department)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept.value} value={dept.value}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              <Label>Assign to Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an employee (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {employees.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No employees in this department
                </p>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-2">
              <Label>Deadline *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !deadline && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {deadline ? format(deadline, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={setDeadline}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Details</Label>
                <Textarea
                  placeholder="Add task details..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Attachments</Label>
                <div className="flex gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="mr-2 size-4" />
                    Upload Files
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Max file size: {formatFileSize(MAX_FILE_SIZE)}
                </p>

                {uploadingFiles.length > 0 && (
                  <div className="space-y-1">
                    {uploadingFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between rounded border p-2 text-sm">
                        <span className="truncate">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeUploadingFile(i)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              Back
            </Button>

            {step < 5 ? (
              <Button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
              >
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Creating...' : 'Create Task'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
