import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  breadcrumb?: { label: string; href: string }
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, breadcrumb, action, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 sm:px-6',
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {breadcrumb && (
          <>
            <Link
              href={breadcrumb.href}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {breadcrumb.label}
            </Link>
            <span className="text-muted-foreground shrink-0">/</span>
          </>
        )}
        <h1 className="font-semibold text-foreground truncate">{title}</h1>
      </div>
      {action && <div className="ml-4 shrink-0">{action}</div>}
    </div>
  )
}
