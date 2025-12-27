'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { Department } from '@/types/database'

export async function saveEmployeeDepartments(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  const departments = formData.getAll('departments') as Department[]

  if (departments.length === 0) {
    redirect('/employee/onboarding?error=Please select at least one department')
  }

  // Delete existing departments for this employee
  await supabase
    .from('employee_departments')
    .delete()
    .eq('employee_id', user.id)

  // Insert new departments
  const { error: insertError } = await supabase
    .from('employee_departments')
    .insert(
      departments.map((dept) => ({
        employee_id: user.id,
        department: dept,
      }))
    )

  if (insertError) {
    redirect(`/employee/onboarding?error=${encodeURIComponent(insertError.message)}`)
  }

  // Update profile to mark onboarding as complete
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ 
      has_completed_onboarding: true,
      updated_at: new Date().toISOString() 
    })
    .eq('id', user.id)

  if (updateError) {
    redirect(`/employee/onboarding?error=${encodeURIComponent(updateError.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/employee')
}

export async function getEmployeeDepartments(): Promise<Department[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('employee_departments')
    .select('department')
    .eq('employee_id', user.id)

  return data?.map((d) => d.department as Department) || []
}
