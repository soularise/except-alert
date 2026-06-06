'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, FileCode2, BarChart2, Settings, LogOut } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

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
    <aside className="flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-4 py-5">
        <p className="text-sm font-semibold text-sidebar-foreground">ExceptAlert</p>
        <p className="text-xs text-zinc-400">Event monitor</p>
      </div>

      <nav className="flex flex-col gap-1 px-2">
        {navItems.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive(href)
                ? 'bg-amber-500/10 text-amber-500'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {!authDisabled && (
        <div className="mt-auto px-2 pb-4">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      )}
    </aside>
  )
}
