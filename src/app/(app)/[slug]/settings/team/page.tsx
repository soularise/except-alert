'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTenant } from '@/components/TenantProvider'

type Member = {
  id: string
  name: string
  email: string
  role: string
  joinedAt: string
}

type Invitation = {
  id: string
  email: string
  role: string
  token: string
  expiresAt: string
}

export default function TeamPage() {
  const { tenant, authDisabled } = useTenant()
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const loadTeam = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/${tenant.slug}/team`)
      if (!res.ok) throw new Error('Failed to load team')
      const data = await res.json() as { members: Member[]; invitations: Invitation[] }
      setMembers(data.members)
      setInvitations(data.invitations)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team')
    } finally {
      setLoading(false)
    }
  }, [tenant.slug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTeam()
  }, [loadTeam])

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setInviteUrl(null)

    try {
      const res = await fetch(`/api/${tenant.slug}/team/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json() as { inviteUrl?: string; error?: string }
      if (!res.ok || !data.inviteUrl) {
        throw new Error(data.error ?? 'Failed to send invite')
      }
      setInviteUrl(data.inviteUrl)
      setEmail('')
      setRole('member')
      await loadTeam()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ width: '960px', maxWidth: '100%' }}>
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-foreground">Team</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage who can access {tenant.name}.
        </p>
      </div>

      {authDisabled ? (
        <div
          className="mb-8 max-w-3xl rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground"
          style={{ width: '760px', maxWidth: '100%' }}
        >
          Team invitations are available when authentication is enabled.
        </div>
      ) : (
        <form onSubmit={inviteMember} className="mb-8 flex max-w-3xl flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-72"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(value) => value && setRole(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Inviting...' : 'Invite'}
          </Button>
        </form>
      )}

      {inviteUrl && (
        <div className="mb-6 max-w-3xl rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-700">Invite link created</p>
          <p className="mt-1 break-all text-muted-foreground">{inviteUrl}</p>
        </div>
      )}

      {error && <p className="mb-6 text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-medium text-foreground">Members</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell className="capitalize">{member.role}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-foreground">Pending invitations</h2>
            {invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending invitations.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>{invitation.email}</TableCell>
                      <TableCell className="capitalize">{invitation.role}</TableCell>
                      <TableCell>{new Date(invitation.expiresAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
