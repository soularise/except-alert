import { redirect } from 'next/navigation'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { returnTo } = await searchParams
  const safeReturnTo =
    returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('\\')
      ? returnTo
      : null
  const suffix = safeReturnTo ? `&returnTo=${encodeURIComponent(safeReturnTo)}` : ''
  redirect(`/login?signup=disabled${suffix}`)
}
