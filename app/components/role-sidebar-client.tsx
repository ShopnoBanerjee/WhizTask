"use client"

import * as React from "react"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ChevronUp, LogOut, ClipboardList, History, BarChart3, Users, Clock, User } from 'lucide-react'
import { signOut } from '@/lib/auth/actions'

// nav item interface reused by server component (not strictly needed client-side)
export interface NavItem {
  title: string
  url: string
  Icon: React.ElementType
}

interface SidebarClientProps {
  userEmail: string
  role: 'admin' | 'employee' | 'client_servicing'
}

export function SidebarClient({ userEmail, role }: SidebarClientProps) {
  const pathname = usePathname()

  const userInitials = userEmail
    ? userEmail.substring(0, 2).toUpperCase()
    : '??'

  const navItems: NavItem[] = []
  if (role === 'admin' || role === 'client_servicing') {
    navItems.push(
      { title: 'Tasks', url: '/admin/tasks', Icon: ClipboardList },
      { title: 'History', url: '/admin/history', Icon: History }
    )
  }
  if (role === 'admin') {
    navItems.push(
      { title: 'Analytics', url: '/admin/analytics', Icon: BarChart3 },
      { title: 'Clients', url: '/admin/clients', Icon: Users }
    )
  }
  if (role === 'employee' || role === 'client_servicing') {
    navItems.push(
      { title: 'My Tasks', url: '/employee/tasks', Icon: ClipboardList },
      { title: 'Time Logger', url: '/employee/time-logger', Icon: Clock },
      { title: 'History', url: '/employee/history', Icon: History },
      { title: 'Profile', url: '/employee/profile', Icon: User }
    )
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <Link href="/" className="flex items-center gap-2">
          <img src="/anonymous_logo.svg" alt="WhizTask Logo" className="h-12" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                // use url instead of title for key to guarantee uniqueness
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.url)}>
                    <Link href={item.url} className="flex items-center gap-2">
                      <item.Icon className="size-4" />
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
                {userEmail || 'User'}
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
