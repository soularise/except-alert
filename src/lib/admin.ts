import { auth } from './auth'

const DEFAULT_PLATFORM_ADMIN_EMAILS = ['hello@exceptalert.com', 'droidsafari@gmail.com']

function configuredPlatformAdminEmails() {
  const configured =
    process.env.EXCEPTALERT_ADMIN_EMAILS ??
    process.env.EXCEPTALERT_ADMIN_EMAIL ??
    DEFAULT_PLATFORM_ADMIN_EMAILS.join(',')

  return configured
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isPlatformAdminEmail(email: string | null | undefined) {
  if (!email) return false
  return configuredPlatformAdminEmails().includes(email.toLowerCase())
}

export async function getAdminSession(headers: Headers) {
  if (process.env.EXCEPTALERT_AUTH_DISABLED === 'true') return null

  const session = await auth.api.getSession({ headers })
  if (!isPlatformAdminEmail(session?.user.email)) return null

  return session
}
