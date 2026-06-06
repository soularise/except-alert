import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { tenantInvitations, tenants } from '@/lib/db/schema'
import { AcceptInviteClient } from './AcceptInviteClient'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect(`/login?returnTo=/invite/${token}`)

  const [invitation] = await db
    .select({
      email: tenantInvitations.email,
      role: tenantInvitations.role,
      expiresAt: tenantInvitations.expiresAt,
      acceptedAt: tenantInvitations.acceptedAt,
      tenantName: tenants.name,
    })
    .from(tenantInvitations)
    .innerJoin(tenants, eq(tenantInvitations.tenantId, tenants.id))
    .where(eq(tenantInvitations.token, token))
    .limit(1)

  if (!invitation) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-sm space-y-2">
          <h1 className="text-2xl font-semibold">Invitation not found</h1>
          <p className="text-sm text-muted-foreground">Ask the sender for a new invite link.</p>
        </div>
      </div>
    )
  }

  const expired = new Date() > invitation.expiresAt
  const wrongEmail = invitation.email.toLowerCase() !== session.user.email.toLowerCase()

  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Join {invitation.tenantName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You were invited as {invitation.role}.
          </p>
        </div>

        {invitation.acceptedAt ? (
          <p className="text-sm text-muted-foreground">This invitation has already been used.</p>
        ) : expired ? (
          <p className="text-sm text-destructive">This invitation has expired.</p>
        ) : wrongEmail ? (
          <p className="text-sm text-destructive">
            Sign in as {invitation.email} to accept this invitation.
          </p>
        ) : (
          <AcceptInviteClient token={token} />
        )}
      </div>
    </div>
  )
}
