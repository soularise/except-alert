import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getFirstTenantForUser } from '@/lib/tenancy'
import { SetupClient } from './SetupClient'

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  const { returnTo } = await searchParams
  const safeReturnTo =
    returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('\\')
      ? returnTo
      : null

  if (!session) {
    const suffix = safeReturnTo ? `?returnTo=${encodeURIComponent(safeReturnTo)}` : ''
    redirect(`/login${suffix}`)
  }

  if (safeReturnTo?.startsWith('/invite/')) {
    redirect(safeReturnTo)
  }

  const firstTenant = await getFirstTenantForUser(session.user.id)
  if (firstTenant) redirect(`/${firstTenant.slug}/dashboard`)

  return <SetupClient />
}
