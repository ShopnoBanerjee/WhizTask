import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')
  // Only allow same-site paths, so `next` can't be used to redirect elsewhere
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/auth/verify-org'

  // Supabase reports expired/used links as ?error=...&error_description=...
  const linkError = searchParams.get('error_description') ?? searchParams.get('error')
  if (linkError) {
    return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(linkError)}`)
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error?message=Could not authenticate user`)
}
