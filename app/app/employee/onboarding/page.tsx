import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { saveEmployeeDepartments, getEmployeeDepartments } from '@/lib/employee/actions'
import { DEPARTMENTS } from '@/types/database'

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const { error } = await searchParams
  const existingDepartments = await getEmployeeDepartments()

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Select Your Departments</CardTitle>
          <CardDescription>
            Choose the departments you work in. You can select multiple departments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form action={saveEmployeeDepartments} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {DEPARTMENTS.map((dept) => (
                <div key={dept.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={dept.value}
                    name="departments"
                    value={dept.value}
                    defaultChecked={existingDepartments.includes(dept.value)}
                  />
                  <Label htmlFor={dept.value} className="cursor-pointer">
                    {dept.label}
                  </Label>
                </div>
              ))}
            </div>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
