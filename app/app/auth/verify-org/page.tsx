import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { verifyOrgCode } from '@/lib/auth/actions'

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function VerifyOrgPage({ searchParams }: PageProps) {
  const { error } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Enter Organization Code</CardTitle>
          <CardDescription>
            Please enter the code provided by your organization to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form action={verifyOrgCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org_code">Organization Code</Label>
              <Input
                id="org_code"
                name="org_code"
                type="text"
                placeholder="Enter your org code"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Verify & Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
