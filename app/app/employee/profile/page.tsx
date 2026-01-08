import { ProfileSettings } from '@/components/employee/profile-settings'
import { getEmployeeProfile, getEmployeeDepartments } from '@/lib/employee/actions'
import { redirect } from 'next/navigation'

export default async function EmployeeProfilePage() {
  const [profile, departments] = await Promise.all([
    getEmployeeProfile(),
    getEmployeeDepartments(),
  ])

  if (!profile) {
    redirect('/auth/login')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your profile information and preferences</p>
      </div>

      <ProfileSettings profile={profile} departments={departments} />
    </div>
  )
}
