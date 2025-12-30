import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/auth/verify-org'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      // Get the user after verification
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Create profile
        const role = user.user_metadata?.role || 'employee'
        const name = user.user_metadata?.name || null
        const email = user.email || ''

        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            role,
            name,
            email,
            is_org_verified: false,
            has_completed_onboarding: false,
          })

        if (profileError) {
          console.error('Error creating profile:', profileError)
          return NextResponse.redirect(`${origin}/auth/error?message=Could not create profile`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error?message=Could not verify email`)
}
