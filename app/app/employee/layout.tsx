import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import SidebarVisibility from '@/components/employee-sidebar-switch'
import RoleSidebar from '@/components/role-sidebar'
import { Separator } from '@/components/ui/separator'

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      {/* client wrapper controls visibility without pulling server deps into client bundle */}
      <SidebarVisibility>
        <RoleSidebar />
      </SidebarVisibility>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <div className="flex-1" />
        </header>
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
