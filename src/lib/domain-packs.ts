export type DomainPackAvailability = 'available' | 'planned'
export type ProviderProofStatus = 'locally_verified'
export type ProviderEvidenceQualification =
  | 'derived_demo_proof'
  | 'synthetic_proof'
  | 'reference_demo_derived_proof'

export type DomainPackProviderStatus = {
  providerId: string
  providerName: string
  normalizedEvent: string
  eventLabel: string
  verificationStatus: ProviderProofStatus
  evidenceQualification: ProviderEvidenceQualification
  evidenceLabel: string
  caveat: string
}

export type DomainPack = {
  id: 'logistics_ops' | 'engineering_ops' | 'app_saas_ops' | 'data_platform_ops' | 'agent_ops'
  title: string
  description: string
  availability: DomainPackAvailability
  proofStatus?: ProviderProofStatus
  caveat: string
  providers?: readonly DomainPackProviderStatus[]
}

// Catalog metadata only. Tenant enablement, source configuration, and current
// verification health are separate concerns and intentionally remain outside
// this read model.
export const DOMAIN_PACKS: readonly DomainPack[] = [
  {
    id: 'logistics_ops',
    title: 'Logistics Ops',
    description: 'Shipment, vehicle, device, temperature, fault, and location exceptions.',
    availability: 'available',
    proofStatus: 'locally_verified',
    caveat: 'Evidence-backed through a local three-provider demo. It is not production verified.',
    providers: [
      {
        providerId: 'tive',
        providerName: 'Tive',
        normalizedEvent: 'tive.temperature_excursion',
        eventLabel: 'Temperature excursion',
        verificationStatus: 'locally_verified',
        evidenceQualification: 'derived_demo_proof',
        evidenceLabel: 'Derived/demo local proof',
        caveat: 'Not production verified.',
      },
      {
        providerId: 'samsara',
        providerName: 'Samsara',
        normalizedEvent: 'samsara.vehicle.fault_detected',
        eventLabel: 'Vehicle fault',
        verificationStatus: 'locally_verified',
        evidenceQualification: 'synthetic_proof',
        evidenceLabel: 'Synthetic local proof',
        caveat: 'Representative Alert Webhooks 2.0 payload still required before production-readiness claims.',
      },
      {
        providerId: 'sensos',
        providerName: 'Sensos',
        normalizedEvent: 'sensos.temperature_excursion',
        eventLabel: 'Temperature breach',
        verificationStatus: 'locally_verified',
        evidenceQualification: 'reference_demo_derived_proof',
        evidenceLabel: 'Reference/demo-derived local proof',
        caveat: 'Not production verified.',
      },
    ],
  },
  {
    id: 'engineering_ops',
    title: 'Engineering Ops',
    description: 'Engineering workflow monitoring, including GitHub, Vercel, CI/CD, and EOS lifecycle signals.',
    availability: 'planned',
    caveat: 'Planned only. Existing sources do not establish this domain pack or its proof status.',
  },
  {
    id: 'app_saas_ops',
    title: 'App / SaaS Ops',
    description: 'Application, customer, account, and subscription workflow monitoring.',
    availability: 'planned',
    caveat: 'Planned only. Existing sources do not establish this domain pack or its proof status.',
  },
  {
    id: 'data_platform_ops',
    title: 'Data / Platform Ops',
    description: 'Database, storage, function, and platform workflow monitoring.',
    availability: 'planned',
    caveat: 'Planned only. Existing sources do not establish this domain pack or its proof status.',
  },
  {
    id: 'agent_ops',
    title: 'Agent Ops',
    description: 'Agent lifecycle, run observability, checker-node, and sequence-detection monitoring.',
    availability: 'planned',
    caveat: 'Planned only. Existing sources do not establish this domain pack or its proof status.',
  },
]
