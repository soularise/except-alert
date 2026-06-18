'use client'

import { AccountSettings } from '@/components/AccountSettings'
import { useTenant } from '@/components/TenantProvider'

export default function AccountSettingsPage() {
  const { authDisabled } = useTenant()

  return (
    <div className="w-full max-w-4xl space-y-6" style={{ width: '960px', maxWidth: '100%' }}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and password.
        </p>
      </div>
      <AccountSettings authDisabled={authDisabled} />
    </div>
  )
}
