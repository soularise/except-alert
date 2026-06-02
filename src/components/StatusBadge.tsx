import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusStyles: Record<string, string> = {
  open: 'bg-secondary text-secondary-foreground border-transparent',
  acknowledged: 'bg-blue-500 text-white border-transparent hover:bg-blue-500',
  resolved: 'bg-green-500 text-white border-transparent hover:bg-green-500',
  dismissed: 'bg-gray-400/50 text-gray-500 border-transparent',
}

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? 'bg-secondary text-secondary-foreground border-transparent'
  return (
    <Badge className={cn(style)}>
      {status}
    </Badge>
  )
}
