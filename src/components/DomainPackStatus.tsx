import { Badge } from '@/components/ui/badge'
import { DOMAIN_PACKS } from '@/lib/domain-packs'

function titleCase(value: string) {
  return value.replaceAll('_', ' ')
}

function proofStatusLabel(proofStatus: (typeof DOMAIN_PACKS)[number]['proofStatus'], availability: string) {
  if (proofStatus === 'locally_verified') return 'Local demo verified'
  if (proofStatus === 'local_proof_validated') return 'Local proof validated'
  return titleCase(availability)
}

export function DomainPackStatus() {
  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="domain-packs-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="domain-packs-heading" className="text-sm font-semibold text-foreground">
            Domain Packs
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Read-only catalog status. Configuring a source does not verify its provider event contract.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">Read only</Badge>
      </div>

      <div className="mt-4 space-y-3">
        {DOMAIN_PACKS.map((pack) => (
          <div key={pack.id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-medium text-foreground">{pack.title}</h4>
                <p className="mt-0.5 text-xs text-muted-foreground">{pack.description}</p>
              </div>
              <Badge
                variant={pack.availability === 'available' ? 'default' : 'secondary'}
                className={pack.availability === 'available' ? 'bg-green-600 hover:bg-green-600' : undefined}
              >
                {proofStatusLabel(pack.proofStatus, pack.availability)}
              </Badge>
            </div>

            {pack.providers && (
              <ul className="mt-3 space-y-2" aria-label={`${pack.title} provider proof status`}>
                {pack.providers.map((provider) => (
                  <li key={provider.providerId} className="rounded-md bg-muted/40 p-2 text-xs">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium text-foreground">{provider.providerName}</span>
                      <span className="text-muted-foreground">{provider.eventLabel}</span>
                      <Badge variant="secondary" className="text-[10px]">Locally verified</Badge>
                    </div>
                    <code className="mt-1 block text-[11px] text-muted-foreground">{provider.normalizedEvent}</code>
                    <p className="mt-1 text-muted-foreground">{provider.evidenceLabel}. {provider.caveat}</p>
                  </li>
                ))}
              </ul>
            )}

            {pack.proofDetails && (
              <ul className="mt-3 space-y-2" aria-label={`${pack.title} proof maturity`}>
                {pack.proofDetails.map((detail) => (
                  <li key={detail.label} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-md bg-muted/40 p-2 text-xs">
                    <span className="font-medium text-foreground">{detail.label}</span>
                    <span className="text-muted-foreground">{detail.status}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-2 text-xs text-muted-foreground">{pack.caveat}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
