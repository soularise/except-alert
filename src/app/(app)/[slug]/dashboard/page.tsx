import { DashboardClient } from '@/components/DashboardClient'
import { PageHeader } from '@/components/PageHeader'

interface DashboardPageProps {
  searchParams: Promise<{
    source?: string
    severity?: string
    category?: string
    status?: string
  }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams
  const filters = {
    source:   params.source,
    severity: params.severity,
    category: params.category,
    status:   params.status,
  }
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Events" />
      <div className="px-6 py-6">
        <DashboardClient initialFilters={filters} />
      </div>
    </div>
  )
}
