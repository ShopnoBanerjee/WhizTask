'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
    console.log('🔵 useUser mounted')

    const supabase = createClient()
    let mounted = true

    async function getInitialSession() {
      console.log('🟡 Fetching initial session...')

      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error('🔴 getSession error:', error)
        if (mounted) {
          setError(error)
          setIsLoading(false)
        }
        return
      }

      console.log('🟢 Initial session:', data.session)

      if (mounted) {
        setUser(data.session?.user ?? null)
        setIsLoading(false)
      }
    }

    getInitialSession()

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((event, session) => {
        console.log('🟣 Auth state changed:', event)
        console.log('🟣 New session:', session)

        if (!mounted) return

        setUser(session?.user ?? null)
        setIsLoading(false)
      })

    return () => {
      console.log('⚪ useUser unmounted')
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  return { user, isLoading, error }
}