import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db'
import * as schema from './db/schema'

const authSecret = process.env.BETTER_AUTH_SECRET
const passwordResetMode = process.env.EXCEPTALERT_PASSWORD_RESET_MODE ?? 'operator-log'

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
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    ...(passwordResetMode === 'disabled'
      ? {}
      : {
          sendResetPassword: async ({ user, url }) => {
            console.info(
              [
                '[ExceptAlert password reset]',
                `Manual reset requested for ${user.email}.`,
                'Verify the requester out of band, then share this one-use link:',
                url,
              ].join('\n')
            )
          },
        }),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const { createTenantForUser } = await import('./tenancy')
          await createTenantForUser(user.id, user.name)
        },
      },
    },
  },
  secret:  authSecret ?? 'except-alert-local-dev-secret-change-me',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
})
