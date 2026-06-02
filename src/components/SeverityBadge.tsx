import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const severityStyles: Record<string, string> = {
  critical: 'bg-red-600 text-white border-transparent hover:bg-red-600',
  error: 'bg-orange-500 text-white border-transparent hover:bg-orange-500',
  warning: 'bg-yellow-500 text-white border-transparent hover:bg-yellow-500',
  info: 'bg-blue-500 text-white border-transparent hover:bg-blue-500',
}

export function SeverityBadge({ severity }: { severity: string }) {
  const style = severityStyles[severity] ?? 'bg-muted text-muted-foreground border-transparent'
  return (
    <Badge className={cn(style)}>
      {severity}
    </Badge>
  )
}
