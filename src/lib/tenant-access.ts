const ROLE_ORDER = { viewer: 0, member: 1, admin: 2, owner: 3 } as const

export type TenantRole = keyof typeof ROLE_ORDER

export function normalizeTenantRole(role: string | null | undefined): TenantRole | undefined {
  return role && role in ROLE_ORDER ? (role as TenantRole) : undefined
}

export function hasTenantRole(role: string | null | undefined, minRole: TenantRole) {
  const normalizedRole = normalizeTenantRole(role)
  const roleValue = normalizedRole ? ROLE_ORDER[normalizedRole] : -1
  return roleValue >= ROLE_ORDER[minRole]
}

export function sameTenant(
  leftTenantId: string | null | undefined,
  rightTenantId: string | null | undefined
) {
  return Boolean(leftTenantId && rightTenantId && leftTenantId === rightTenantId)
}
