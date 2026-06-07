import { ShieldAlert } from 'lucide-react'

interface AuthPanelProps {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthPanel({
  title,
  subtitle,
  children,
  footer
}: AuthPanelProps) {
  return (
    <div className="flex min-h-full w-full items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border border-border/70 bg-card p-6 text-card-foreground shadow-xl shadow-black/25">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">ExceptAlert</p>
            <p className="text-xs text-muted-foreground">Event monitor</p>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {children}

        {footer && (
          <div className="mt-6 border-t border-border/60 pt-4 text-sm text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
