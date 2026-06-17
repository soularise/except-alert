'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTenant } from '@/components/TenantProvider'
import { PageHeader } from '@/components/PageHeader'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = useTenant()
  const pathname = usePathname()
  const base = `/${tenant.slug}/settings`

  const tabs = [
    { label: 'General',   href: base },
    { label: 'Providers', href: `${base}/providers` },
    { label: 'Team',      href: `${base}/team` },
  ]

  return (
    <div className="flex h-full w-full flex-col" style={{ width: '100%' }}>
      <PageHeader title="Settings" />
      <div className="overflow-x-auto border-b px-4 sm:px-6" style={{ width: '100%' }}>
        <nav className="-mb-px flex min-w-max gap-6">
          {tabs.map(({ label, href }) => {
            const active = href === base
              ? pathname === base
              : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`py-3 text-sm border-b-2 transition-colors ${
                  active
                    ? 'border-primary text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="w-full flex-1 overflow-auto px-4 py-6 sm:px-6" style={{ width: '100%' }}>
        {children}
      </div>
    </div>
  )
}
