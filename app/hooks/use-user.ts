'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client' // should return a browser client (anon key)
import type { User } from '@supabase/supabase-js'

interface UseUserReturn {
  user: User | null
  isLoading: boolean
  error: Error | null
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const newUser = session?.user ?? null
        if (!mounted) return
        setUser(newUser)
      }
    )

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  return { user, isLoading, error }
}
