'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import type { UserRole } from '@/types/auth'

// Base URL for links sent by email. Falls back to the request's own origin so
// a missing NEXT_PUBLIC_SITE_URL can't produce "undefined/auth/..." links.
async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) {
    const trimmed = configured.trim().replace(/\/+$/, '')
    // Tolerate a value saved without a scheme (e.g. "my-app.vercel.app")
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  }

  const h = await headers()
  const origin = h.get('origin')
  if (origin) return origin

  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect(`/auth/error?message=${encodeURIComponent(error.message)}`)
  }

  // Go straight to the dashboard. Redirecting to "/" left people on the public
  // landing page, where they had to click "Sign in" a second time. The proxy
  // still sends unverified or not-yet-onboarded users to the right step.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  revalidatePath('/', 'layout')
  redirect(profile?.role === 'admin' ? '/admin' : '/employee')
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as UserRole

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
      },
      emailRedirectTo: `${await getSiteUrl()}/auth/callback`,
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

  console.log('verifyOrgCode role:', profile?.role)

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

  // The server client uses the PKCE flow, so the email link comes back with a
  // `?code=` that must be exchanged for a session. Route it through
  // /auth/callback, which does the exchange and then forwards to the form.
  const siteUrl = await getSiteUrl()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/update-password`,
  })

  if (error) {
    console.error(error)
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
