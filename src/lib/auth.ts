import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db'
import * as schema from './db/schema'

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
  emailAndPassword: { enabled: true },
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
  secret:  process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
})
