'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'
import { setMemberAccess } from '@/lib/admin/member-actions'
import { DEPARTMENTS, type OrgMember } from '@/types/database'

const ROLE_LABELS: Record<OrgMember['role'], string> = {
  admin: 'Admin',
  employee: 'Employee',
  client_servicing: 'Client Servicing',
}

type StatusFilter = 'active' | 'removed' | 'all'

interface MemberListProps {
  initialMembers: OrgMember[]
  currentUserId: string | null
  currentUserRole: OrgMember['role'] | null
  loadError?: string
}

export function MemberList({ initialMembers, currentUserId, currentUserRole, loadError }: MemberListProps) {
  const [members, setMembers] = useState(initialMembers)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [confirming, setConfirming] = useState<OrgMember | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(loadError ?? null)

  const counts = useMemo(() => ({
    active: members.filter((m) => m.isActive).length,
    removed: members.filter((m) => !m.isActive).length,
    all: members.length,
  }), [members])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return members.filter((m) => {
      if (statusFilter === 'active' && !m.isActive) return false
      if (statusFilter === 'removed' && m.isActive) return false
      if (!term) return true
      return (m.name || '').toLowerCase().includes(term) || (m.email || '').toLowerCase().includes(term)
    })
  }, [members, search, statusFilter])

  async function changeAccess(member: OrgMember, active: boolean) {
    setPendingId(member.id)
    setError(null)
    const result = await setMemberAccess(member.id, active)
    if (result.error) {
      setError(result.error)
    } else {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? { ...m, isActive: active, removedAt: active ? null : new Date().toISOString() }
            : m
        )
      )
    }
    setPendingId(null)
  }

  const departmentLabel = (value: string) => DEPARTMENTS.find((d) => d.value === value)?.label || value

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
            <TabsTrigger value="removed">Removed ({counts.removed})</TabsTrigger>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          type="search"
          placeholder="Search by name or email"
          aria-label="Search members"
          className="w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Departments</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {search
                    ? 'No members match this search.'
                    : statusFilter === 'removed'
                      ? 'No one has been removed.'
                      : 'No members yet.'}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((member) => {
                const isSelf = member.id === currentUserId
                // only an admin can change another admin's access
                const adminOnly = member.role === 'admin' && currentUserRole !== 'admin'
                const pending = pendingId === member.id
                return (
                  <TableRow key={member.id} className={member.isActive ? undefined : 'text-muted-foreground'}>
                    <TableCell>
                      <div className="font-medium">
                        {member.name || 'No name'}
                        {isSelf && <span className="ml-1 font-normal text-muted-foreground">(you)</span>}
                      </div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                    </TableCell>
                    <TableCell>{ROLE_LABELS[member.role] || member.role}</TableCell>
                    <TableCell className="max-w-56">
                      {member.departments.length > 0
                        ? member.departments.map(departmentLabel).join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {member.joinedAt ? format(new Date(member.joinedAt), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      {member.isActive ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <div>
                          <Badge variant="outline">Removed</Badge>
                          {member.removedAt && (
                            <div className="mt-1 text-xs">
                              {format(new Date(member.removedAt), 'MMM d, yyyy')}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isSelf ? (
                        <span className="text-xs text-muted-foreground">Can&apos;t change your own</span>
                      ) : adminOnly ? (
                        <span className="text-xs text-muted-foreground">Admins only</span>
                      ) : member.isActive ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          disabled={pending}
                          onClick={() => setConfirming(member)}
                        >
                          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                          Remove access
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => changeAccess(member, true)}
                        >
                          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                          Restore access
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {confirming?.name || confirming?.email} from the organization?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will be blocked from WhizTask the next time they open a page. Their tasks,
              subtasks and time logs are kept, and they stay assigned to their current work until
              you reassign it. You can restore their access at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming) changeAccess(confirming, false)
                setConfirming(null)
              }}
            >
              Remove access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
