import { randomBytes } from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { db } from './db'
import { tenantMemberships, tenants } from './db/schema'
import type { Plan } from './plan-limits'

export class OrganizationLifecycleError extends Error {
  constructor(
    public code:
      | 'self_serve_organization_exists'
      | 'invalid_organization_name'
      | 'duplicate_slug',
    message: string
  ) {
    super(message)
  }
}

export function slugifyOrganizationName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'org'
}

export function createIngressKey() {
  return `org_${randomBytes(16).toString('hex')}`
}

export async function createSelfServeFreeOrganization(
  userId: string,
  organizationName: string,
  plan: Plan = 'free'
) {
  return createOrganization({
    userId,
    organizationName,
    plan,
    selfServe: true,
  })
}

export async function createPaidOrganization(input: {
  ownerUserId: string
  organizationName: string
  plan: Exclude<Plan, 'free'>
}) {
  return createOrganization({
    userId: input.ownerUserId,
    organizationName: input.organizationName,
    plan: input.plan,
    selfServe: false,
  })
}

async function createOrganization(input: {
  userId: string
  organizationName: string
  plan: Plan
  selfServe: boolean
}) {
  const name = input.organizationName.trim()
  if (!name) {
    throw new OrganizationLifecycleError(
      'invalid_organization_name',
      'Organization name is required.'
    )
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.userId}), 0)`)

    if (input.selfServe) {
      const existing = await tx.query.tenants.findFirst({
        where: eq(tenants.createdByUserId, input.userId),
      })
      if (existing) {
        throw new OrganizationLifecycleError(
          'self_serve_organization_exists',
          'This account already created a self-serve organization.'
        )
      }
    }

    const slugBase = slugifyOrganizationName(name)
    let slug = slugBase
    const existingSlug = await tx.query.tenants.findFirst({ where: eq(tenants.slug, slugBase) })
    if (existingSlug) {
      slug = ''
      for (let i = 0; i < 10; i += 1) {
        const candidate = `${slugBase}-${randomBytes(2).toString('hex')}`
        const taken = await tx.query.tenants.findFirst({ where: eq(tenants.slug, candidate) })
        if (!taken) {
          slug = candidate
          break
        }
      }
      if (!slug) {
        throw new OrganizationLifecycleError(
          'duplicate_slug',
          'Could not find an available organization slug.'
        )
      }
    }

    const [tenant] = await tx
      .insert(tenants)
      .values({
        name,
        slug,
        plan: input.plan,
        createdByUserId: input.selfServe ? input.userId : null,
        ingressKey: createIngressKey(),
      })
      .returning()

    await tx
      .insert(tenantMemberships)
      .values({
        userId: input.userId,
        tenantId: tenant.id,
        role: 'owner',
      })
      .onConflictDoNothing()

    return tenant
  })
}
