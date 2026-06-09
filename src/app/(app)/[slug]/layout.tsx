import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenants } from '@/lib/db/schema'
import { DEFAULT_TENANT_ID, getServerSession, getTenantMembership } from '@/lib/tenancy'
import { TenantProvider } from '@/components/TenantProvider'
import { AppSidebar } from '@/components/AppSidebar'

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  if (process.env.EXCEPTALERT_AUTH_DISABLED === 'true') {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, DEFAULT_TENANT_ID))
      .limit(1)
    if (!tenant) notFound()
    return (
      <div className="flex h-full">
        <AppSidebar slug={slug} authDisabled />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <TenantProvider tenant={tenant} role="owner" authDisabled>
            {children}
          </TenantProvider>
        </main>
      </div>
    )
  }

  const session = await getServerSession()
  if (!session) notFound()

  const membership = await getTenantMembership(slug, session.user.id)
  if (!membership) notFound()

  return (
    <div className="flex h-full">
      <AppSidebar slug={slug} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <TenantProvider
          tenant={membership.tenant}
          role={membership.role as 'owner' | 'admin' | 'member' | 'viewer'}
        >
          {children}
        </TenantProvider>
      </main>
    </div>
  )
}
