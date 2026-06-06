import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFirstTenantForUser } from '@/lib/tenancy'

export default async function HomePage() {
  if (process.env.EXCEPTALERT_AUTH_DISABLED === 'true') {
    redirect('/default/dashboard')
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  const row = await getFirstTenantForUser(session.user.id)
  if (!row) redirect('/setup')

  redirect(`/${row.slug}/dashboard`)
}
