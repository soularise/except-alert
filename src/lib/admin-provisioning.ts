import { randomBytes, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'
import { db } from './db'
import { authAccount, authUser, tenantMemberships, tenants } from './db/schema'
import { createIngressKey } from './organization-lifecycle'

type ProvisionInput = {
  customerEmail: string
  customerName: string
  organizationName?: string
  slugOverride?: string
  adminUserId: string
}

type ProvisionResult = {
  email: string
  name: string
  organizationName: string
  slug: string
  loginUrl: string
  tempPassword: string
}

export class ProvisioningError extends Error {
  constructor(
    public code: 'duplicate_email' | 'duplicate_slug' | 'invalid_slug' | 'unknown',
    message: string
  ) {
    super(message)
  }
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function generateTempPassword() {
  return randomBytes(18).toString('base64url')
}

export async function provisionCustomer(input: ProvisionInput): Promise<ProvisionResult> {
  const email = input.customerEmail.trim().toLowerCase()
  const name = input.customerName.trim()
  const organizationName = input.organizationName?.trim() || `${name}'s Org`
  const slugBase = slugify(input.slugOverride?.trim() || organizationName)
  const hasSlugOverride = Boolean(input.slugOverride?.trim())

  if (!slugBase) {
    throw new ProvisioningError('invalid_slug', 'Organization name must produce a valid slug.')
  }

  const tempPassword = generateTempPassword()
  const passwordHash = await hashPassword(tempPassword)
  const now = new Date()

  const tenant = await db.transaction(async (tx) => {
    const [existingUser] = await tx
      .select({ id: authUser.id })
      .from(authUser)
      .where(eq(authUser.email, email))
      .limit(1)

    if (existingUser) {
      throw new ProvisioningError('duplicate_email', 'A user with that email already exists.')
    }

    const slug = await resolveTenantSlug(tx, slugBase, hasSlugOverride)
    const userId = randomUUID()

    await tx.insert(authUser).values({
      id: userId,
      name,
      email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })

    await tx.insert(authAccount).values({
      id: randomUUID(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    })

    const [createdTenant] = await tx
      .insert(tenants)
      .values({
        name: organizationName,
        slug,
        plan: 'pro',
        ingressKey: createIngressKey(),
      })
      .returning()

    await tx.insert(tenantMemberships).values({
      userId,
      tenantId: createdTenant.id,
      role: 'owner',
      invitedBy: input.adminUserId,
    })

    return createdTenant
  })

  return {
    email,
    name,
    organizationName,
    slug: tenant.slug,
    loginUrl: getLoginUrl(),
    tempPassword,
  }
}

async function resolveTenantSlug(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  slugBase: string,
  hasSlugOverride: boolean
) {
  const [existing] = await tx
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slugBase))
    .limit(1)

  if (!existing) return slugBase

  if (hasSlugOverride) {
    throw new ProvisioningError('duplicate_slug', 'A tenant with that slug already exists.')
  }

  for (let i = 0; i < 8; i += 1) {
    const candidate = `${slugBase}-${randomBytes(2).toString('hex')}`
    const [collision] = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, candidate))
      .limit(1)

    if (!collision) return candidate
  }

  throw new ProvisioningError('duplicate_slug', 'Could not find an available tenant slug.')
}

function getLoginUrl() {
  const baseUrl =
    process.env.EXCEPTALERT_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    'http://localhost:3000'

  return `${baseUrl.replace(/\/$/, '')}/login`
}
