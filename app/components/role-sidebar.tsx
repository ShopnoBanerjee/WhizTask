
import { createClient } from '@/lib/supabase/server'
import { SidebarClient } from './role-sidebar-client'

export default async function RoleSidebar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role,email')
    .eq('id', user.id)
    .single()

  console.log('RoleSidebar server load', { user: user.id, role: profile?.role })

  const role = profile?.role as 'admin' | 'employee' | 'client_servicing'

  return <SidebarClient userEmail={profile?.email || ''} role={role} />
}
