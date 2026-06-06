'use client'

import { createContext, useContext } from 'react'
import type { tenants } from '@/lib/db/schema'

type Tenant = typeof tenants.$inferSelect

type TenantContextValue = {
  tenant: Tenant
  role: 'owner' | 'admin' | 'member' | 'viewer'
}

const TenantContext = createContext<TenantContextValue | null>(null)

export function TenantProvider({
  tenant,
  role,
  children,
}: TenantContextValue & { children: React.ReactNode }) {
  return (
    <TenantContext.Provider value={{ tenant, role }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used within a TenantProvider')
  return ctx
}
