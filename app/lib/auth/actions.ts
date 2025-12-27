'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/types/auth'

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect(`/auth/error?message=${encodeURIComponent(error.message)}`)
  }

  // Middleware will handle redirect based on org verification status
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as UserRole

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    redirect(`/auth/error?message=${encodeURIComponent(error.message)}`)
  }

  redirect('/auth/signup-success')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function verifyOrgCode(formData: FormData) {
  const supabase = await createClient()

  const orgCode = formData.get('org_code') as string

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/auth/login')
  }

  // Check if org code exists
  const { data: org, error: orgError } = await supabase
    .from('org')
    .select('id, name')
    .eq('org_code', orgCode)
    .single()

  if (orgError || !org) {
    redirect(`/auth/verify-org?error=${encodeURIComponent('Invalid organization code')}`)
  }

  // Update user's profile with org_id and set is_org_verified to true
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      org_id: org.id,
      is_org_verified: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updateError) {
    redirect(`/auth/verify-org?error=${encodeURIComponent('Failed to verify organization')}`)
  }

  // Get user's role from profile to redirect to correct dashboard
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  revalidatePath('/', 'layout')
  
  if (profile?.role === 'admin') {
    redirect('/admin')
  } else {
    redirect('/employee')
  }
}

export async function forgotPassword(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/update-password`,
  })

  if (error) {
    redirect(`/auth/error?message=${encodeURIComponent(error.message)}`)
  }

  redirect('/auth/forgot-password?success=true')
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()

  const password = formData.get('password') as string

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    redirect(`/auth/error?message=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/auth/login?message=Password updated successfully')
}
