import { notFound } from 'next/navigation'
import { AgentOpsProofView } from '@/components/AgentOpsProofView'
import { PageHeader } from '@/components/PageHeader'

export default function AgentOpsProofPage() {
  // This route is intentionally absent from primary navigation and unavailable in production.
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Agent Ops run detail proof" />
      <div className="px-4 py-6 sm:px-6">
        <AgentOpsProofView />
      </div>
    </div>
  )
}
