'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuditLogWithUser } from '@/types/database'

interface AuditLogViewerProps {
  logs: AuditLogWithUser[]
}

const ENTITY_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'client', label: 'Client' },
  { value: 'software', label: 'Software' },
  { value: 'overhead', label: 'Overhead' },
]

const ACTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Created' },
  { value: 'update', label: 'Updated' },
  { value: 'delete', label: 'Deleted' },
]

export function AuditLogViewer({ logs }: AuditLogViewerProps) {
  const [entityFilter, setEntityFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredLogs = logs.filter((log) => {
    if (entityFilter !== 'all' && log.entity_type !== entityFilter) return false
    if (actionFilter !== 'all' && log.action !== actionFilter) return false
    if (searchTerm && !log.entity_name.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  function formatDate(dateString: string) {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(dateString))
  }

  function formatValue(value: unknown) {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  function getActionBadge(action: string) {
    switch (action) {
      case 'create':
        return <Badge variant="default">Created</Badge>
      case 'update':
        return <Badge variant="secondary">Updated</Badge>
      case 'delete':
        return <Badge variant="destructive">Deleted</Badge>
      default:
        return <Badge variant="outline">{action}</Badge>
    }
  }

  function getEntityBadge(entityType: string) {
    switch (entityType) {
      case 'client':
        return <Badge variant="outline">Client</Badge>
      case 'software':
        return <Badge variant="outline">Software</Badge>
      case 'overhead':
        return <Badge variant="outline">Overhead</Badge>
      default:
        return <Badge variant="outline">{entityType}</Badge>
    }
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No audit logs found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Changes to clients, software, and overheads will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label>Search</Label>
          <Input
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-48"
          />
        </div>
        <div className="space-y-1">
          <Label>Entity Type</Label>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Action</Label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((action) => (
                <SelectItem key={action.value} value={action.value}>
                  {action.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Date</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[100px]">Action</TableHead>
              <TableHead>Old Value</TableHead>
              <TableHead>New Value</TableHead>
              <TableHead className="w-[120px]">Changed By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No logs match your filters
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell>{getEntityBadge(log.entity_type)}</TableCell>
                  <TableCell className="font-medium">{log.entity_name}</TableCell>
                  <TableCell>{getActionBadge(log.action)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                    {formatValue(log.old_value)}
                  </TableCell>
                  <TableCell className="text-sm max-w-[150px] truncate">
                    {formatValue(log.new_value)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.user_email || 'System'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filteredLogs.length} of {logs.length} logs
      </p>
    </div>
  )
}
