import { MemberList } from '@/components/admin/member-list'
import { getOrgMembers } from '@/lib/admin/member-actions'

export default async function MembersPage() {
  const { members, currentUserId, currentUserRole, error } = await getOrgMembers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Members</h1>
        <p className="text-muted-foreground">
          Everyone in your organization. Removing someone blocks their access but keeps their tasks and time logs.
        </p>
      </div>

      <MemberList
        initialMembers={members}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        loadError={error}
      />
    </div>
  )
}
