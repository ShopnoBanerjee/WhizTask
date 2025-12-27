import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Button asChild size="lg">
        <Link href="/auth/login">Sign In / Sign Up</Link>
      </Button>
    </div>
  )
}
