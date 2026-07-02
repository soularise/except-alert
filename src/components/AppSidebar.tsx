'use client'

import type { ComponentType } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FileCode2,
  BarChart2,
  Activity,
  PlugZap,
  Settings,
  LogOut,
  Menu,
  ShieldAlert,
  X,
  User,
  UserPlus,
  Building2,
} from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { limitsFor } from '@/lib/plan-limits'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { PaletteToggle } from '@/components/PaletteToggle'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type OrganizationOption = {
  name: string
  slug: string
  role: string
}

function SidebarUsageMeter({
  monthlyUsage,
  plan,
}: {
  monthlyUsage: number
  plan?: string
}) {
  const limit = limitsFor(plan).externalEventsPerMonth
  const percent =
    limit === null ? 0 : Math.min(100, Math.round((monthlyUsage / limit) * 100))
  const nearLimit = limit !== null && percent >= 80

  return (
    <div
      title="Monthly external events."
      className="mx-2 mb-3 rounded-md px-3 py-2"
    >
      <div className="flex items-center justify-between text-xs text-sidebar-foreground/50">
        <span>Usage</span>
        <span className={cn(nearLimit && 'font-medium text-amber-500')}>
          {monthlyUsage.toLocaleString()}
          {limit !== null && ` / ${limit.toLocaleString()}`}
        </span>
      </div>
      {limit !== null && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sidebar-accent">
          <div
            className={cn('h-full rounded-full bg-primary', nearLimit && 'bg-amber-500')}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  )
}

interface AppSidebarProps {
  slug: string
  authDisabled?: boolean
  organizations?: OrganizationOption[]
  monthlyUsage?: number
  plan?: string
}

export function AppSidebar({
  slug,
  authDisabled = false,
  organizations = [],
  monthlyUsage,
  plan,
}: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const base = `/${slug}`
  const userName = authDisabled ? 'Local developer' : session?.user.name?.trim()
  const userEmail = authDisabled ? null : session?.user.email
  const userLabel = userName || userEmail || null

  const navItems: Array<{
    label: string
    href: string
    icon: ComponentType<{ className?: string }>
    active?: 'exact' | 'prefix' | 'settings'
  }> = [
    { label: 'Events', href: `${base}/dashboard`, icon: LayoutDashboard },
    { label: 'Sources', href: `${base}/settings/providers`, icon: PlugZap },
    { label: 'Controllers', href: `${base}/settings/controller-jobs`, icon: Activity },
    { label: 'Actions', href: `${base}/templates`, icon: FileCode2 },
    { label: 'Alert Rules', href: `${base}/baselines`, icon: BarChart2 },
    { label: 'Settings', href: `${base}/settings`, icon: Settings, active: 'settings' },
  ]

  function isActive(href: string, mode: 'exact' | 'prefix' | 'settings' = 'prefix') {
    if (href === '/admin/provision') return pathname === href

    if (href === `${base}/dashboard`) {
      return (
        pathname === href ||
        (pathname.startsWith(`${base}/dashboard/`) &&
          !pathname.includes('/templates') &&
          !pathname.includes('/baselines') &&
          !pathname.includes('/settings'))
      )
    }

    if (mode === 'exact') return pathname === href
    if (mode === 'settings') {
      return (
        pathname === `${base}/settings` ||
        pathname.startsWith(`${base}/settings/team`) ||
        pathname.startsWith(`${base}/settings/account`)
      )
    }

    return pathname.startsWith(href)
  }

  async function handleSignOut() {
    await authClient.signOut()
    setMobileOpen(false)
    router.push('/login')
  }

  function handleOrganizationChange(nextSlug: string | null) {
    if (!nextSlug || nextSlug === slug) return
    setMobileOpen(false)
    router.push(`/${nextSlug}/dashboard`)
  }

  useEffect(() => {
    if (!mobileOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen])

  useEffect(() => {
    if (authDisabled) return

    let cancelled = false
    fetch('/api/admin/status')
      .then((res) => (res.ok ? res.json() : { isPlatformAdmin: false }))
      .then((data) => {
        if (!cancelled) setIsPlatformAdmin(Boolean(data.isPlatformAdmin ?? data.isAdmin))
      })
      .catch(() => {
        if (!cancelled) setIsPlatformAdmin(false)
      })

    return () => {
      cancelled = true
    }
  }, [authDisabled])

  function sidebarContent(mobile = false) {
    return (
      <>
        <div className="flex items-start justify-between gap-3 px-4 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 shrink-0 text-primary" />
              <p className="font-semibold text-sidebar-foreground">ExceptAlert</p>
            </div>
            <p className="mt-0.5 pl-7 text-xs text-sidebar-foreground/50">Event monitor</p>
          </div>
          {mobile && (
            <button
              type="button"
              aria-label="Close navigation"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {userLabel && (
          <div className="px-4 pb-5">
            <div className="flex min-w-0 items-center gap-2 rounded-md border border-sidebar-border/70 bg-sidebar-accent/40 px-3 py-2">
              <User className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-medium text-sidebar-foreground"
                  title={userLabel}
                >
                  {userLabel}
                </p>
                {userEmail && userEmail !== userLabel && (
                  <p
                    className="truncate text-xs text-sidebar-foreground/50"
                    title={userEmail}
                  >
                    {userEmail}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!authDisabled && organizations.length > 1 && (
          <div className="px-4 pb-5">
            <Select value={slug} onValueChange={handleOrganizationChange}>
              <SelectTrigger className="h-auto min-h-10 w-full border-sidebar-border/70 bg-sidebar-accent/40 px-3 py-2 text-left text-sidebar-foreground">
                <Building2 className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((organization) => (
                  <SelectItem key={organization.slug} value={organization.slug}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Separator className="bg-sidebar-border" />

        <nav className="flex flex-col gap-1 px-2 pt-4">
          <p className="mb-1 px-3 text-xs font-medium uppercase tracking-widest text-sidebar-foreground/30">
            Navigation
          </p>
          {navItems.map(({ label, href, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive(href, active)
                  ? 'bg-primary/10 text-primary'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {isPlatformAdmin && (
          <nav className="flex flex-col gap-1 px-2 pt-4">
            <p className="mb-1 px-3 text-xs font-medium uppercase tracking-widest text-sidebar-foreground/30">
              Platform
            </p>
            <Link
              href="/admin/provision"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive('/admin/provision')
                  ? 'bg-primary/10 text-primary'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <UserPlus className="h-4 w-4 shrink-0" />
              Provision
            </Link>
          </nav>
        )}

        <div className="mt-auto">
          {typeof monthlyUsage === 'number' && (
            <SidebarUsageMeter
              monthlyUsage={monthlyUsage}
              plan={plan}
            />
          )}
          <Separator className="mb-3 bg-sidebar-border" />
          <PaletteToggle />
          {!authDisabled && (
            <div className="px-2 pb-4">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground md:hidden">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-5 shrink-0 text-primary" />
          <span className="font-semibold">ExceptAlert</span>
        </div>
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          className="flex size-9 items-center justify-center rounded-md transition-colors hover:bg-sidebar-accent"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="size-5" />
        </button>
      </header>

      <aside className="hidden h-full w-60 shrink-0 flex-col bg-sidebar md:flex">
        {sidebarContent()}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-background/70"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-[min(18rem,85vw)] flex-col bg-sidebar shadow-xl">
            {sidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  )
}
