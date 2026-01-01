'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle } from 'lucide-react'
import { updateEmployeeProfile, saveEmployeeDepartments } from '@/lib/employee/actions'
import { DEPARTMENTS, type Department, type Profile } from '@/types/database'

interface ProfileSettingsProps {
  profile: Profile
  departments: Department[]
}

export function ProfileSettings({ profile, departments }: ProfileSettingsProps) {
  const [name, setName] = useState(profile.name || '')
  const [selectedDepts, setSelectedDepts] = useState<Department[]>(departments)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    
    const formData = new FormData()
    formData.set('name', name)

    startTransition(async () => {
      const result = await updateEmployeeProfile(formData)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Profile updated successfully' })
      }
    })
  }

  const handleDepartmentToggle = (dept: Department) => {
    setSelectedDepts(prev => 
      prev.includes(dept)
        ? prev.filter(d => d !== dept)
        : [...prev, dept]
    )
  }

  const handleDepartmentsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedDepts.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one department' })
      return
    }

    const formData = new FormData()
    selectedDepts.forEach(dept => formData.append('departments', dept))

    startTransition(async () => {
      // This will redirect, so we don't need to handle the result
      await saveEmployeeDepartments(formData)
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription className="flex items-center gap-2">
            {message.type === 'success' && <CheckCircle className="size-4" />}
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                value={profile.email || ''} 
                disabled 
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Departments */}
      <Card>
        <CardHeader>
          <CardTitle>Departments</CardTitle>
          <CardDescription>
            Select the departments you work in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDepartmentsSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {DEPARTMENTS.map(dept => (
                <div key={dept.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={dept.value}
                    checked={selectedDepts.includes(dept.value)}
                    onCheckedChange={() => handleDepartmentToggle(dept.value)}
                  />
                  <Label 
                    htmlFor={dept.value} 
                    className="text-sm font-normal cursor-pointer"
                  >
                    {dept.label}
                  </Label>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedDepts.map(dept => (
                <Badge key={dept} variant="secondary">
                  {DEPARTMENTS.find(d => d.value === dept)?.label}
                </Badge>
              ))}
            </div>

            <Button type="submit" disabled={isPending || selectedDepts.length === 0}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Update Departments
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <Badge variant="outline" className="capitalize">{profile.role}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Member since</span>
            <span>{new Date(profile.created_at).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
