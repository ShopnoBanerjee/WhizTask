import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { forgotPassword } from '@/lib/auth/actions'

interface PageProps {
  searchParams: Promise<{ success?: string }>
}

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const { success } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            Enter your email to receive a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success && (
            <Alert className="mb-4">
              <AlertDescription>
                Check your email for a password reset link.
              </AlertDescription>
            </Alert>
          )}
          <form action={forgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Send Reset Link
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          Remember your password?{' '}
          <Link href="/auth/login" className="text-foreground hover:underline ml-1">
            Sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
