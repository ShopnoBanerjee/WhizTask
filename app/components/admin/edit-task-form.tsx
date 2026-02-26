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
import { CalendarIcon, Plus, Upload, X, Loader2, Trash2, Paperclip } from 'lucide-react'
import { updateTask, getClients, getEmployeesByDepartment, getProfile } from '@/lib/admin/actions'
import { uploadTaskAttachment, validateFileSize, formatFileSize } from '@/lib/supabase/storage'
import { 
  DEPARTMENTS, 
  MAX_FILE_SIZE, 
  type Client, 
  type Department, 
  type EmployeeWithDepartments, 
  type TaskAttachment, 
  type Profile, 
  type TaskWithRelations, 
  type SubtaskFormData,
  type SubtaskWithRelations
} from '@/types/database'
import { useUser } from '@/hooks/use-user'

interface EditTaskFormProps {
  task: TaskWithRelations
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskUpdated?: (task: TaskWithRelations) => void
}

interface EditSubtaskFormData extends SubtaskFormData {
  id?: string // Existing subtask ID
  existingAttachments: TaskAttachment[]
}

const createEditSubtask = (subtask?: SubtaskWithRelations): EditSubtaskFormData => {
  if (subtask) {
    return {
      id: subtask.id,
      title: subtask.title,
      details: subtask.details || '',
      department: subtask.department,
      assigned_to: subtask.assigned_to || '',
      deadline: new Date(subtask.deadline),
      deadlineTime: format(new Date(subtask.deadline), 'HH:mm'),
      attachments: [],
      uploadingFiles: [],
      existingAttachments: subtask.attachments || [],
    }
  }
  return {
    title: '',
    details: '',
    department: '',
    assigned_to: '',
    deadline: undefined,
    deadlineTime: '10:30',
    attachments: [],
    uploadingFiles: [],
    existingAttachments: [],
  }
}

export function EditTaskForm({ task, open, onOpenChange, onTaskUpdated }: EditTaskFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [clients, setClients] = useState<Client[]>([])
  const [employees, setEmployees] = useState<EmployeeWithDepartments[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [selectedClient, setSelectedClient] = useState<string>(task.client_id)
  const [selectedDepartment, setSelectedDepartment] = useState<Department>(task.department)
  const [selectedEmployee, setSelectedEmployee] = useState<string>(task.assigned_to ?? 'unassigned')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(task.deadline))
  const [selectedTime, setSelectedTime] = useState<string>(format(new Date(task.deadline), 'HH:mm'))
  const [details, setDetails] = useState(task.details || '')
  const [existingAttachments, setExistingAttachments] = useState<TaskAttachment[]>(task.attachments || [])
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([])

  // Subtasks state
  const hasSubtasks = (task.subtasks && task.subtasks.length > 0) || false
  const [subtasks, setSubtasks] = useState<EditSubtaskFormData[]>(
    task.subtasks?.map(st => createEditSubtask(st)) || []
  )
  const [subtaskEmployeesMap, setSubtaskEmployeesMap] = useState<Record<number, EmployeeWithDepartments[]>>({})
  const [loadingSubtaskEmployees, setLoadingSubtaskEmployees] = useState<Record<number, boolean>>({})

  const { user } = useUser()
  const [profile, setProfile] = useState<Profile | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const subtaskFileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  useEffect(() => {
    if (user?.id) {
      getProfile(user.id).then(result => {
        if (!result.error) {
          setProfile(result.profile)
        }
      })
    }
  }, [user?.id])

  useEffect(() => {
    if (open) {
      loadClients()
      if (selectedDepartment && !hasSubtasks) {
        loadEmployees(selectedDepartment)
      }
      // Load employees for existing subtasks
      subtasks.forEach((st, index) => {
        if (st.department) {
          loadSubtaskEmployees(index, st.department as Department)
        }
      })
    }
  }, [open])

  useEffect(() => {
    // Reset form when task changes
    setSelectedClient(task.client_id)
    setSelectedDepartment(task.department)
    setSelectedEmployee(task.assigned_to ?? 'unassigned')
    setSelectedDate(new Date(task.deadline))
    setSelectedTime(format(new Date(task.deadline), 'HH:mm'))
    setDetails(task.details || '')
    setExistingAttachments(task.attachments || [])
    setUploadingFiles([])
    setSubtasks(task.subtasks?.map(st => createEditSubtask(st)) || [])
    setError(null)
  }, [task])

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

  function removeExistingAttachment(index: number) {
    setExistingAttachments(prev => prev.filter((_, i) => i !== index))
  }

  function removeSubtaskUploadingFile(subtaskIndex: number, fileIndex: number) {
    updateSubtask(subtaskIndex, {
      uploadingFiles: subtasks[subtaskIndex].uploadingFiles.filter((_, i) => i !== fileIndex)
    })
  }

  function removeSubtaskExistingAttachment(subtaskIndex: number, attachmentIndex: number) {
    updateSubtask(subtaskIndex, {
      existingAttachments: subtasks[subtaskIndex].existingAttachments.filter((_, i) => i !== attachmentIndex)
    })
  }

  function addSubtask() {
    setSubtasks(prev => [...prev, createEditSubtask()])
  }

  function removeSubtask(index: number) {
    setSubtasks(prev => prev.filter((_, i) => i !== index))
  }

  function updateSubtask(index: number, updates: Partial<EditSubtaskFormData>) {
    setSubtasks(prev => prev.map((st, i) => i === index ? { ...st, ...updates } : st))
  }

  async function handleSubmit() {
    if (!selectedClient) {
      setError('Please select a client')
      return
    }

    // Validate based on mode
    if (hasSubtasks || subtasks.length > 0) {
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
      const tempTaskId = task.id

      // Upload main task attachments
      const uploadedAttachments: TaskAttachment[] = [...existingAttachments]
      
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

      if (subtasks.length > 0) {
        // Subtask mode
        formData.set('department', subtasks[0].department as string)
        formData.set('assigned_to', '')
        
        // Upload subtask attachments and prepare subtask data
        const subtasksData = []
        for (let i = 0; i < subtasks.length; i++) {
          const st = subtasks[i]
          const subtaskAttachments: TaskAttachment[] = [...st.existingAttachments]
          
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
            id: st.id, // Include existing ID for updates
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

      const result = await updateTask(task.id, formData)

      if (result.error) {
        setError(result.error)
      } else {
        onOpenChange(false)
        if (onTaskUpdated && result.task) {
          onTaskUpdated(result.task)
        }
      }
    } catch (err) {
      setError('Failed to update task')
    } finally {
      setLoading(false)
    }
  }

  const renderSubtaskForm = (subtask: EditSubtaskFormData, index: number) => (
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
          {subtask.id && <Badge variant="outline" className="text-xs">Existing</Badge>}
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
          
          {/* Existing attachments */}
          {subtask.existingAttachments.length > 0 && (
            <div className="space-y-1 mt-1">
              {subtask.existingAttachments.map((att, attIdx) => (
                <div key={attIdx} className="flex items-center justify-between rounded border px-2 py-1 text-xs bg-muted/50">
                  <span className="truncate flex items-center gap-1">
                    <Paperclip className="size-3" />
                    {att.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => removeSubtaskExistingAttachment(index, attIdx)}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          {/* New files to upload */}
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={subtasks.length > 0 ? "max-w-2xl max-h-[90vh]" : "max-w-md max-h-[90vh]"}>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Client *</Label>
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

            {/* Task Details */}
            <div className="space-y-2">
              <Label>Task Details</Label>
              <Textarea
                placeholder="Add task details..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
              />
            </div>

            {/* Task Attachments */}
            <div className="space-y-2">
              <Label>Task Attachments</Label>
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
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 size-4" />
                  Upload Files
                </Button>
              </div>
              
              {existingAttachments.length > 0 && (
                <div className="space-y-1">
                  {existingAttachments.map((att, i) => (
                    <div key={i} className="flex items-center justify-between rounded border p-2 text-sm bg-muted/50">
                      <span className="truncate flex items-center gap-1">
                        <Paperclip className="size-3" />
                        {att.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeExistingAttachment(i)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

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

            {/* Subtasks Section */}
            {(hasSubtasks || subtasks.length > 0) ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Subtasks</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addSubtask}>
                    <Plus className="mr-1 size-4" />
                    Add Subtask
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {subtasks.map((st, i) => renderSubtaskForm(st, i))}
                </div>
              </div>
            ) : (
              /* Single Task Mode */
              <>
                <div className="space-y-2">
                  <Label>Department *</Label>
                  <Select 
                    value={selectedDepartment} 
                    onValueChange={(v) => {
                      setSelectedDepartment(v as Department)
                      loadEmployees(v as Department)
                    }}
                  >
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

                <div className="space-y-2">
                  <Label>Assign to Employee (Optional)</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee} disabled={loadingEmployees}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingEmployees ? "Loading..." : "Choose an employee"} />
                      {loadingEmployees && <Loader2 className="ml-2 size-4 animate-spin" />}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {employees.map((emp) => {
                        if (!emp?.id) console.warn('employee with empty id in Select options', emp)
                        return (
                          <SelectItem key={emp.id} value={String(emp.id)}>
                            {emp.name || emp.email}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Deadline *</Label>
                  <div className="flex gap-4">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-between font-normal">
                          {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : "Date"}
                          <CalendarIcon className="ml-2 size-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => date && setSelectedDate(date)}
                          captionLayout="dropdown"
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>

                {/* Option to add subtasks to existing single task */}
                <div className="pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={addSubtask}>
                    <Plus className="mr-1 size-4" />
                    Convert to Subtasks
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add subtasks to assign different parts to different employees
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
