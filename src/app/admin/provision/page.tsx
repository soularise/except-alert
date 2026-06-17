import { notFound, redirect } from 'next/navigation'
import { AppSidebar } from '@/components/AppSidebar'
import { isPlatformAdminEmail } from '@/lib/admin'
import { getFirstTenantForUser, getServerSession } from '@/lib/tenancy'
import { ProvisionClient } from './ProvisionClient'

export default async function AdminProvisionPage() {
  if (process.env.EXCEPTALERT_AUTH_DISABLED === 'true') notFound()

  const session = await getServerSession()
  if (!session) {
    redirect(`/login?returnTo=${encodeURIComponent('/admin/provision')}`)
  }

  if (!isPlatformAdminEmail(session.user.email)) notFound()

  const firstTenant = await getFirstTenantForUser(session.user.id)

  const content = (hasSidebar: boolean) => (
    <main
      className={`min-w-0 flex-1 overflow-y-auto bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8 ${
        hasSidebar ? 'pt-22 md:pt-8' : ''
      }`}
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <p className="text-sm font-medium text-primary">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Provision Customer</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Create a customer account, tenant, owner membership, and temporary password.
          </p>
        </div>
        <ProvisionClient adminTenantSlug={firstTenant?.slug ?? null} />
      </div>
    </main>
  )

  if (!firstTenant) {
    return <div className="flex h-full">{content(false)}</div>
  }

  return (
    <div className="flex h-full">
      <AppSidebar slug={firstTenant.slug} />
      {content(true)}
    </div>
  )
}
