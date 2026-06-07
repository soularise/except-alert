import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/tenancy'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (process.env.EXCEPTALERT_AUTH_DISABLED === 'true') {
    return <>{children}</>
  }

  const session = await getServerSession()
  if (!session) redirect('/login')

  return <>{children}</>
}
