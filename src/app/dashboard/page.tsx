import { DashboardClient } from '@/components/DashboardClient'

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
    source: params.source,
    severity: params.severity,
    category: params.category,
    status: params.status,
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <DashboardClient initialFilters={filters} />
    </main>
  )
}
