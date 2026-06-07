interface SummaryTilesProps {
  openCount: number
  criticalCount: number
  recentCount: number
}

export function SummaryTiles({ openCount, criticalCount, recentCount }: SummaryTilesProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-xl border border-border/50 border-l-4 border-l-primary bg-card shadow-sm p-4">
        <p className="text-3xl font-bold text-foreground">{openCount}</p>
        <p className="text-sm text-muted-foreground mt-1">Open Events</p>
      </div>
      <div className="rounded-xl border border-border/50 border-l-4 border-l-red-600 bg-card shadow-sm p-4">
        <p className={`text-3xl font-bold ${criticalCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
          {criticalCount}
        </p>
        <p className="text-sm text-muted-foreground mt-1">Critical</p>
      </div>
      <div className="rounded-xl border border-border/50 border-l-4 border-l-amber-500 bg-card shadow-sm p-4">
        <p className="text-3xl font-bold text-foreground">{recentCount}</p>
        <p className="text-sm text-muted-foreground mt-1">Last 60s</p>
      </div>
    </div>
  )
}
