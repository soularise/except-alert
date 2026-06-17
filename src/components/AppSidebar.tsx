'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FileCode2,
  BarChart2,
  Settings,
  LogOut,
  Menu,
  ShieldAlert,
  X,
  User,
  UserPlus,
} from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Separator } from '@/components/ui/separator'
import { PaletteToggle } from '@/components/PaletteToggle'

interface AppSidebarProps {
  slug: string
  authDisabled?: boolean
}

export function AppSidebar({ slug, authDisabled = false }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const base = `/${slug}`
  const userName = authDisabled ? 'Local developer' : session?.user.name?.trim()
  const userEmail = authDisabled ? null : session?.user.email
  const userLabel = userName || userEmail || null

  const navItems = [
    { label: 'Events',    href: `${base}/dashboard`,  icon: LayoutDashboard },
    { label: 'Templates', href: `${base}/templates`,  icon: FileCode2 },
    { label: 'Baselines', href: `${base}/baselines`,  icon: BarChart2 },
    { label: 'Settings',  href: `${base}/settings`,   icon: Settings },
  ]

  function isActive(href: string) {
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
    return pathname.startsWith(href)
  }

  async function handleSignOut() {
    await authClient.signOut()
    setMobileOpen(false)
    router.push('/login')
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

        <Separator className="bg-sidebar-border" />

        <nav className="flex flex-col gap-1 px-2 pt-4">
          <p className="mb-1 px-3 text-xs font-medium uppercase tracking-widest text-sidebar-foreground/30">
            Navigation
          </p>
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive(href)
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
