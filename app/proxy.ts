import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/proxy'

const publicRoutes = ['/', '/auth/login', '/auth/signup', '/auth/signup-success', '/auth/error', '/auth/forgot-password', '/auth/callback', '/auth/confirm']
const authRoutes = ['/auth/login', '/auth/signup', '/auth/forgot-password']

const ACCESS_REMOVED_PATH = '/auth/access-removed'

// An admin removed this person from the organisation. Their data is kept, but
// every page except the notice (and signing out) is closed to them.
function isRemoved(profile: { is_active?: boolean | null } | null): boolean {
  return profile?.is_active === false
}

function accessRemoved(request: NextRequest) {
  return NextResponse.redirect(new URL(ACCESS_REMOVED_PATH, request.url))
}

export async function proxy(request: NextRequest) {
  const { supabase, response } = createClient(request)
  const { pathname } = request.nextUrl

  // Verify the session. getClaims() checks the JWT signature locally when the
  // project uses asymmetric signing keys and otherwise falls back to asking the
  // Auth server, so this is never slower than getUser(). It runs on every
  // request, including each server action.
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    // If user is logged in and tries to access auth routes, redirect appropriately
    if (user && authRoutes.includes(pathname)) {
      // Check if user is org verified
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (isRemoved(profile)) return accessRemoved(request)

      if (!profile?.is_org_verified) {
        return NextResponse.redirect(new URL('/auth/verify-org', request.url))
      }

      // Check if employee needs onboarding (client_servicing treated as employee here)
      if ((profile.role === 'employee' || profile.role === 'client_servicing') && !profile.has_completed_onboarding) {
        return NextResponse.redirect(new URL('/employee/onboarding', request.url))
      }

      // Redirect to appropriate dashboard
      const redirectUrl = profile.role === 'admin' ? '/admin' : '/employee'
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }
    return response
  }

  // Protect verify-org route - requires auth but not org verification
  if (pathname === '/auth/verify-org') {
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    // Check if already verified
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (isRemoved(profile)) return accessRemoved(request)

    if (profile?.is_org_verified) {
      // Check if employee needs onboarding
      if (profile.role === 'employee' && !profile.has_completed_onboarding) {
        return NextResponse.redirect(new URL('/employee/onboarding', request.url))
      }
      const redirectUrl = profile.role === 'admin' ? '/admin' : '/employee'
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    return response
  }

  // Protect employee onboarding route
  if (pathname === '/employee/onboarding') {
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (isRemoved(profile)) return accessRemoved(request)

    if (!profile?.is_org_verified) {
      return NextResponse.redirect(new URL('/auth/verify-org', request.url))
    }

    // Only true employees can access onboarding; client_servicing has already been onboarded
    if (profile.role !== 'employee') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }

    // If already completed onboarding, redirect to employee dashboard
    if (profile.has_completed_onboarding) {
      return NextResponse.redirect(new URL('/employee', request.url))
    }

    return response
  }

  // Shown to members an admin has removed. Anyone else is sent on their way.
  if (pathname === ACCESS_REMOVED_PATH) {
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!isRemoved(profile)) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  // Protect update-password route - requires auth
  if (pathname === '/auth/update-password') {
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    return response
  }

  // All other routes require authentication
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Get user profile for role and org verification
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (isRemoved(profile)) return accessRemoved(request)

  // If not org verified, redirect to verify-org page
  if (!profile?.is_org_verified) {
    return NextResponse.redirect(new URL('/auth/verify-org', request.url))
  }

  // Check if employee needs onboarding (treat client_servicing same as employee)
  if ((profile.role === 'employee' || profile.role === 'client_servicing') && !profile.has_completed_onboarding) {
    return NextResponse.redirect(new URL('/employee/onboarding', request.url))
  }

  // Role-based route protection
  const isAdminRoute = pathname.startsWith('/admin')
  const isEmployeeRoute = pathname.startsWith('/employee')


  if (isAdminRoute) {
    if (profile.role === 'admin') {
      // allowed
    } else if (profile.role === 'client_servicing') {
      // restrict to tasks/history/members only
      if (
        !pathname.startsWith('/admin/tasks') &&
        !pathname.startsWith('/admin/history') &&
        !pathname.startsWith('/admin/members') &&
        pathname !== '/admin'
      ) {
        console.log('redirect client_servicing from admin route', pathname)
        return NextResponse.redirect(new URL('/admin/tasks', request.url))
      }
    } else {
      return NextResponse.redirect(new URL('/employee', request.url))
    }
  }

  if (isEmployeeRoute && profile.role === 'admin') {
    // admins shouldn't hit employee routes
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // allow employee and client_servicing on employee routes

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
