'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, FileCode2, BarChart2, Settings, LogOut, ShieldAlert } from 'lucide-react'
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
  const base = `/${slug}`

  const navItems = [
    { label: 'Events',    href: `${base}/dashboard`,  icon: LayoutDashboard },
    { label: 'Templates', href: `${base}/templates`,  icon: FileCode2 },
    { label: 'Baselines', href: `${base}/baselines`,  icon: BarChart2 },
    { label: 'Settings',  href: `${base}/settings`,   icon: Settings },
  ]

  function isActive(href: string) {
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
    router.push('/login')
  }

  return (
    <aside className="flex w-60 flex-col bg-sidebar">
      {/* Brand */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary shrink-0" />
          <p className="font-semibold text-sidebar-foreground">ExceptAlert</p>
        </div>
        <p className="mt-0.5 text-xs text-sidebar-foreground/50 pl-7">Event monitor</p>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Nav */}
      <nav className="flex flex-col gap-1 px-2 pt-4">
        <p className="mb-1 px-3 text-xs font-medium uppercase tracking-widest text-sidebar-foreground/30">
          Navigation
        </p>
        {navItems.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
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

      {/* Footer */}
      <div className="mt-auto">
        <Separator className="bg-sidebar-border mb-3" />
        <PaletteToggle />
        {!authDisabled && (
          <div className="px-2 pb-4">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
