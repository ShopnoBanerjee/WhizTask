'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { signOut } from '@/lib/auth/actions'
import { useUser } from '@/hooks/use-user'
import {
  Clock,
  ClipboardList,
  History,
  User,
  ChevronUp,
  LogOut,
} from 'lucide-react'

const navItems = [
  {
    title: 'My Tasks',
    url: '/employee/tasks',
    icon: ClipboardList,
  },
  {
    title: 'Time Logger',
    url: '/employee/time-logger',
    icon: Clock,
  },
  {
    title: 'History',
    url: '/employee/history',
    icon: History,
  },
  {
    title: 'Profile',
    url: '/employee/profile',
    icon: User,
  },
]

export function EmployeeSidebar() {
  const pathname = usePathname()
  const { user } = useUser()

  const userInitials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'EM'

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <Link href="/employee" className="flex items-center gap-2">
          <span className="text-xl font-bold">WhizTask</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.url || (item.url === '/employee' && pathname === '/employee')}
                  >
                    <Link href={item.url}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Avatar className="size-6">
                <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
              </Avatar>
              <span className="truncate flex-1 text-left text-sm">
                {user?.email || 'Employee'}
              </span>
              <ChevronUp className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem asChild>
              <form action={signOut}>
                <button type="submit" className="flex w-full items-center gap-2">
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
