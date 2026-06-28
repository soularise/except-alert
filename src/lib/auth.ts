import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db'
import * as schema from './db/schema'

const authSecret = process.env.BETTER_AUTH_SECRET
const passwordResetMode = process.env.EXCEPTALERT_PASSWORD_RESET_MODE ?? 'operator-log'
const authBaseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
const defaultTrustedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.BETTER_AUTH_URL,
  process.env.EXCEPTALERT_APP_URL,
]
  .filter((origin): origin is string => Boolean(origin))
  .map((origin) => new URL(origin).origin)

if (
  process.env.NODE_ENV === 'production' &&
  process.env.EXCEPTALERT_AUTH_DISABLED !== 'true' &&
  !authSecret
) {
  throw new Error('BETTER_AUTH_SECRET is required in production')
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user:         schema.authUser,
      session:      schema.authSession,
      account:      schema.authAccount,
      verification: schema.authVerification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    ...(passwordResetMode === 'disabled'
      ? {}
      : {
          sendResetPassword: async ({ user, url }, request) => {
            console.info(
              [
                '[ExceptAlert password reset]',
                `Manual reset requested for ${user.email}.`,
                'Verify the requester out of band, then share this one-use link:',
                url,
              ].join('\n')
            )

            try {
              const { createPasswordResetRequestEvents } = await import('./password-reset-events')
              await createPasswordResetRequestEvents({ user, resetUrl: url, request })
            } catch (err) {
              console.error('[password reset] failed to create ExceptAlert event:', err)
            }
          },
        }),
  },
  secret:  authSecret ?? 'except-alert-local-dev-secret-change-me',
  baseURL: authBaseUrl,
  trustedOrigins: Array.from(new Set(defaultTrustedOrigins)),
})
