"use client"

import { usePathname } from 'next/navigation'
import React from 'react'

// client wrapper that conditionally renders its children based on path
export default function SidebarVisibility({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  // hide sidebar during the onboarding flow (employee selects departments)
  if (pathname.startsWith('/employee/onboarding')) {
    return null
  }

  return <>{children}</>
}
