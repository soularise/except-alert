import { DomainPackStatus } from '@/components/DomainPackStatus'

export default function DomainPacksPage() {
  return (
    <div className="w-full space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Domain Packs</h2>
        <p className="text-sm text-muted-foreground">
          Operational context over configured sources and their available proof evidence.
        </p>
      </div>
      <DomainPackStatus />
    </div>
  )
}
