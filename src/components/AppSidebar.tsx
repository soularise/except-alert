'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileCode2, BarChart2, Settings } from 'lucide-react'

const navItems = [
  { label: 'Events', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Templates', href: '/dashboard/templates', icon: FileCode2 },
  { label: 'Baselines', href: '/dashboard/baselines', icon: BarChart2 },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/dashboard') {
      return (
        pathname === '/dashboard' ||
        (pathname.startsWith('/dashboard/') &&
          !pathname.startsWith('/dashboard/templates') &&
          !pathname.startsWith('/dashboard/baselines') &&
          !pathname.startsWith('/dashboard/settings'))
      )
    }
    return pathname.startsWith(href)
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
    </aside>
  )
}
