'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { CalendarIcon, Plus, Upload, X, Loader2, ChevronDownIcon, Trash2, ListTodo, User } from 'lucide-react'
import { createTask, getClients, getEmployeesByDepartment, getProfile } from '@/lib/admin/actions'
import { uploadTaskAttachment, validateFileSize, formatFileSize } from '@/lib/supabase/storage'
import { DEPARTMENTS, MAX_FILE_SIZE, type Client, type Department, type EmployeeWithDepartments, type TaskAttachment, type Profile, type TaskWithRelations, type SubtaskFormData } from '@/types/database'
import { useUser } from '@/hooks/use-user'

interface CreateTaskFormProps {
  onTaskCreated?: (task: TaskWithRelations) => void
}

const emptySubtask = (): SubtaskFormData => ({
  title: '',
  details: '',
  department: '',
  assigned_to: '',
  deadline: undefined,
  deadlineTime: '10:30',
  attachments: [],
  uploadingFiles: [],
})

export function CreateTaskForm({ onTaskCreated }: CreateTaskFormProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [clients, setClients] = useState<Client[]>([])
  const [employees, setEmployees] = useState<EmployeeWithDepartments[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [selectedDepartment, setSelectedDepartment] = useState<Department | ''>('')
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedTime, setSelectedTime] = useState<string>('10:30')
  const [details, setDetails] = useState('')
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([])

  // Subtasks state
  const [hasSubtasks, setHasSubtasks] = useState(false)
  const [subtasks, setSubtasks] = useState<SubtaskFormData[]>([])
  const [subtaskEmployeesMap, setSubtaskEmployeesMap] = useState<Record<number, EmployeeWithDepartments[]>>({})
  const [loadingSubtaskEmployees, setLoadingSubtaskEmployees] = useState<Record<number, boolean>>({})

  const { user } = useUser()
  const [profile, setProfile] = useState<Profile | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const subtaskFileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  useEffect(() => {
    if (user?.id) {
      getProfile(user.id).then(result => {
        if (result.error) {
          console.error('Failed to get profile:', result.error)
        } else {
          setProfile(result.profile)
        }
      })
    }
  }, [user?.id])

  useEffect(() => {
    if (open) {
      loadClients()
    }
  }, [open])

  useEffect(() => {
    if (selectedDepartment && !hasSubtasks) {
      loadEmployees(selectedDepartment)
    }
  }, [selectedDepartment, hasSubtasks])

  async function loadClients() {
    const data = await getClients()
    setClients(data)
  }

  async function loadEmployees(department: Department) {
    setLoadingEmployees(true)
    try {
      const data = await getEmployeesByDepartment(department)
      setEmployees(data)
    } finally {
      setLoadingEmployees(false)
    }
  }

  async function loadSubtaskEmployees(subtaskIndex: number, department: Department) {
    setLoadingSubtaskEmployees(prev => ({ ...prev, [subtaskIndex]: true }))
    try {
      const data = await getEmployeesByDepartment(department)
      setSubtaskEmployeesMap(prev => ({ ...prev, [subtaskIndex]: data }))
    } finally {
      setLoadingSubtaskEmployees(prev => ({ ...prev, [subtaskIndex]: false }))
    }
  }

  function resetForm() {
    setStep(1)
    setSelectedClient('')
    setSelectedDepartment('')
    setSelectedEmployee('')
    setSelectedDate(undefined)
    setSelectedTime('10:30')
    setDetails('')
    setAttachments([])
    setUploadingFiles([])
    setHasSubtasks(false)
    setSubtasks([])
    setSubtaskEmployeesMap({})
    setLoadingSubtaskEmployees({})
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

  function handleSubtaskFileSelect(subtaskIndex: number, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const validFiles: File[] = []
    
    for (const file of files) {
      if (!validateFileSize(file)) {
        setError(`File "${file.name}" exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`)
        continue
      }
      validFiles.push(file)
    }

    updateSubtask(subtaskIndex, {
      uploadingFiles: [...subtasks[subtaskIndex].uploadingFiles, ...validFiles]
    })
    
    const ref = subtaskFileInputRefs.current[subtaskIndex]
    if (ref) ref.value = ''
  }

  function removeUploadingFile(index: number) {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index))
  }

  function removeSubtaskUploadingFile(subtaskIndex: number, fileIndex: number) {
    updateSubtask(subtaskIndex, {
      uploadingFiles: subtasks[subtaskIndex].uploadingFiles.filter((_, i) => i !== fileIndex)
    })
  }

  function addSubtask() {
    setSubtasks(prev => [...prev, emptySubtask()])
  }

  function removeSubtask(index: number) {
    setSubtasks(prev => prev.filter((_, i) => i !== index))
    setSubtaskEmployeesMap(prev => {
      const newMap = { ...prev }
      delete newMap[index]
      // Re-index remaining entries
      const reindexed: Record<number, EmployeeWithDepartments[]> = {}
      Object.keys(newMap).forEach((key) => {
        const oldIndex = parseInt(key)
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = newMap[oldIndex]
        } else {
          reindexed[oldIndex] = newMap[oldIndex]
        }
      })
      return reindexed
    })
  }

  function updateSubtask(index: number, updates: Partial<SubtaskFormData>) {
    setSubtasks(prev => prev.map((st, i) => i === index ? { ...st, ...updates } : st))
  }

  async function handleSubmit() {
    if (!selectedClient) {
      setError('Please select a client')
      return
    }

    // Validate based on mode
    if (hasSubtasks) {
      if (subtasks.length === 0) {
        setError('Please add at least one subtask')
        return
      }
      for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i]
        if (!st.title.trim()) {
          setError(`Subtask ${i + 1}: Title is required`)
          return
        }
        if (!st.department) {
          setError(`Subtask ${i + 1}: Department is required`)
          return
        }
        if (!st.assigned_to) {
          setError(`Subtask ${i + 1}: Employee assignment is required`)
          return
        }
        if (!st.deadline) {
          setError(`Subtask ${i + 1}: Deadline is required`)
          return
        }
      }
    } else {
      // Single task mode
      if (!selectedDepartment) {
        setError('Please select a department')
        return
      }
      if (!selectedDate || !selectedTime) {
        setError('Please set a deadline')
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      const tempTaskId = crypto.randomUUID()

      // Upload main task attachments
      const uploadedAttachments: TaskAttachment[] = [...attachments]
      
      for (const file of uploadingFiles) {
        if (!profile?.org_id) {
          setError('Organization ID not found. Please try again.')
          setLoading(false)
          return
        }
        
        const result = await uploadTaskAttachment(
          profile.org_id,
          tempTaskId,
          file
        )
        if (result) {
          uploadedAttachments.push(result)
        }
      }

      // Build form data
      const formData = new FormData()
      formData.set('client_id', selectedClient)
      formData.set('details', details)
      formData.set('attachments', JSON.stringify(uploadedAttachments))

      if (hasSubtasks && subtasks.length > 0) {
        // Subtask mode - department is derived from subtasks, deadline from max subtask deadline
        formData.set('department', subtasks[0].department as string) // Primary department from first subtask
        formData.set('assigned_to', '') // No single assignee
        
        // Upload subtask attachments and prepare subtask data
        const subtasksData = []
        for (let i = 0; i < subtasks.length; i++) {
          const st = subtasks[i]
          const subtaskAttachments: TaskAttachment[] = [...st.attachments]
          
          for (const file of st.uploadingFiles) {
            if (!profile?.org_id) continue
            const result = await uploadTaskAttachment(
              profile.org_id,
              `${tempTaskId}-subtask-${i}`,
              file
            )
            if (result) {
              subtaskAttachments.push(result)
            }
          }

          // Combine date and time for subtask deadline
          const subtaskDeadline = new Date(st.deadline!)
          const [hours, minutes] = st.deadlineTime.split(':').map(Number)
          subtaskDeadline.setHours(hours, minutes, 0, 0)

          subtasksData.push({
            title: st.title,
            details: st.details,
            department: st.department,
            assigned_to: st.assigned_to,
            deadline: subtaskDeadline.toISOString(),
            attachments: subtaskAttachments,
          })
        }

        // Max deadline from subtasks
        const maxDeadline = subtasksData.reduce((max, st) => 
          st.deadline > max ? st.deadline : max, subtasksData[0].deadline)
        formData.set('deadline', maxDeadline)
        formData.set('subtasks', JSON.stringify(subtasksData))
      } else {
        // Single task mode
        const deadlineDate = new Date(selectedDate!)
        const [hours, minutes] = selectedTime.split(':').map(Number)
        deadlineDate.setHours(hours, minutes, 0, 0)

        formData.set('department', selectedDepartment as string)
        formData.set('assigned_to', selectedEmployee)
        formData.set('deadline', deadlineDate.toISOString())
        formData.set('subtasks', JSON.stringify([]))
      }

      const result = await createTask(formData)

      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        resetForm()
        if (onTaskCreated && result.task) {
          onTaskCreated(result.task)
        }
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
      case 2: return true // Mode selection - always can proceed
      case 3: 
        if (hasSubtasks) {
          // Need at least one valid subtask
          return subtasks.length > 0 && subtasks.every(st => 
            st.title.trim() && st.department && st.assigned_to && st.deadline
          )
        } else {
          return !!selectedDepartment
        }
      case 4: 
        if (hasSubtasks) return true // Details step
        return true // Employee is optional in single mode
      case 5: 
        if (hasSubtasks) return true // Final review
        return !!selectedDate && !!selectedTime
      default: return true
    }
  }

  const totalSteps = hasSubtasks ? 4 : 6

  const renderSubtaskForm = (subtask: SubtaskFormData, index: number) => (
    <Card key={index} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 size-7"
        onClick={() => removeSubtask(index)}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="secondary">Subtask {index + 1}</Badge>
        </div>
        
        <div className="space-y-1.5">
          <Label className="text-xs">Title *</Label>
          <Input
            placeholder="Subtask title"
            value={subtask.title}
            onChange={(e) => updateSubtask(index, { title: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Department *</Label>
            <Select 
              value={subtask.department} 
              onValueChange={(v) => {
                updateSubtask(index, { department: v as Department, assigned_to: '' })
                loadSubtaskEmployees(index, v as Department)
              }}
            >
              <SelectTrigger className="h-9">
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
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Assign to *</Label>
            <Select 
              value={subtask.assigned_to} 
              onValueChange={(v) => updateSubtask(index, { assigned_to: v })}
              disabled={!subtask.department || loadingSubtaskEmployees[index]}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={
                  loadingSubtaskEmployees[index] ? "Loading..." : 
                  !subtask.department ? "Select dept first" : "Employee"
                } />
              </SelectTrigger>
              <SelectContent>
                {(subtaskEmployeesMap[index] || []).map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name || emp.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Deadline Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-9 justify-between font-normal text-sm">
                  {subtask.deadline ? format(subtask.deadline, 'dd/MM/yyyy') : "Date"}
                  <CalendarIcon className="size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={subtask.deadline}
                  onSelect={(date) => updateSubtask(index, { deadline: date })}
                  captionLayout="dropdown"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Deadline Time *</Label>
            <Input
              type="time"
              value={subtask.deadlineTime}
              onChange={(e) => updateSubtask(index, { deadlineTime: e.target.value })}
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Details</Label>
          <Textarea
            placeholder="Subtask details..."
            value={subtask.details}
            onChange={(e) => updateSubtask(index, { details: e.target.value })}
            rows={2}
            className="text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Attachments</Label>
          <div className="flex gap-2">
            <Input
              ref={(el) => { subtaskFileInputRefs.current[index] = el }}
              type="file"
              multiple
              onChange={(e) => handleSubtaskFileSelect(index, e)}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => subtaskFileInputRefs.current[index]?.click()}
              className="w-full h-8 text-xs"
            >
              <Upload className="mr-1 size-3" />
              Upload
            </Button>
          </div>
          {subtask.uploadingFiles.length > 0 && (
            <div className="space-y-1 mt-1">
              {subtask.uploadingFiles.map((file, fileIdx) => (
                <div key={fileIdx} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                  <span className="truncate">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => removeSubtaskUploadingFile(index, fileIdx)}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm() }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Create Task
        </Button>
      </DialogTrigger>
      <DialogContent className={hasSubtasks && step === 3 ? "max-w-2xl max-h-[90vh]" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle>Create New Task - Step {step}/{totalSteps}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {/* Step 1: Select Client */}
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

          {/* Step 2: Choose Task Type */}
          {step === 2 && (
            <div className="space-y-4">
              <Label>Task Type</Label>
              <div className="grid grid-cols-2 gap-4">
                <Card 
                  className={`cursor-pointer transition-colors hover:bg-accent ${!hasSubtasks ? 'border-primary ring-1 ring-primary' : ''}`}
                  onClick={() => setHasSubtasks(false)}
                >
                  <CardContent className="pt-4 text-center">
                    <User className="mx-auto size-8 mb-2 text-muted-foreground" />
                    <p className="font-medium">Single Task</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Assign to one employee
                    </p>
                  </CardContent>
                </Card>
                <Card 
                  className={`cursor-pointer transition-colors hover:bg-accent ${hasSubtasks ? 'border-primary ring-1 ring-primary' : ''}`}
                  onClick={() => setHasSubtasks(true)}
                >
                  <CardContent className="pt-4 text-center">
                    <ListTodo className="mx-auto size-8 mb-2 text-muted-foreground" />
                    <p className="font-medium">With Subtasks</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Multiple assignees
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Step 3 for Subtasks mode: Add Subtasks */}
          {step === 3 && hasSubtasks && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Subtasks *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addSubtask}>
                  <Plus className="mr-1 size-4" />
                  Add Subtask
                </Button>
              </div>
              
              {subtasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ListTodo className="mx-auto size-12 mb-2 opacity-50" />
                  <p>No subtasks yet</p>
                  <p className="text-sm">Click &quot;Add Subtask&quot; to create one</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {subtasks.map((st, i) => renderSubtaskForm(st, i))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Step 3 for Single mode: Department */}
          {step === 3 && !hasSubtasks && (
            <div className="space-y-2">
              <Label>Select Department *</Label>
              <Select value={selectedDepartment} onValueChange={(v) => { setSelectedDepartment(v as Department); }}>
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

          {/* Step 4 for Subtasks mode: Details & Attachments */}
          {step === 4 && hasSubtasks && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Task Details (shared across subtasks)</Label>
                <Textarea
                  placeholder="Add task details..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Task Attachments (shared)</Label>
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

          {/* Step 4 for Single mode: Employee */}
          {step === 4 && !hasSubtasks && (
            <div className="space-y-2">
              <Label>Assign to Employee (Optional)</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee} disabled={loadingEmployees}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingEmployees ? "Loading employees..." : "Choose an employee (optional)"} />
                  {loadingEmployees && <Loader2 className="ml-2 size-4 animate-spin" />}
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name || emp.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {employees.length === 0 && !loadingEmployees && (
                <p className="text-sm text-muted-foreground">
                  No employees in this department
                </p>
              )}
            </div>
          )}

          {/* Step 5 for Single mode: Deadline */}
          {step === 5 && !hasSubtasks && (
            <div className="space-y-2">
              <Label>Deadline *</Label>
              <div className="flex gap-4">
                <div className="flex flex-col gap-3">
                  <Label className="px-1">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-32 justify-between font-normal"
                      >
                        {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : "Select date"}
                        <ChevronDownIcon />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        captionLayout="dropdown"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-col gap-3">
                  <Label className="px-1">Time</Label>
                  <Input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    step="60"
                    className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                  <p className="text-xs text-muted-foreground">24-hour format</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 6 for Single mode: Details */}
          {step === 6 && !hasSubtasks && (
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

            {step < totalSteps ? (
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
