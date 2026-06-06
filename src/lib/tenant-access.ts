const ROLE_ORDER = { viewer: 0, member: 1, admin: 2, owner: 3 } as const

export type TenantRole = keyof typeof ROLE_ORDER

export function hasTenantRole(role: string | null | undefined, minRole: TenantRole) {
  const roleValue = ROLE_ORDER[role as TenantRole] ?? -1
  return roleValue >= ROLE_ORDER[minRole]
}

export function sameTenant(
  leftTenantId: string | null | undefined,
  rightTenantId: string | null | undefined
) {
  return Boolean(leftTenantId && rightTenantId && leftTenantId === rightTenantId)
}
