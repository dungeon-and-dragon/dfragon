import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BatchKeyPanel } from './components/BatchKeyPanel'
import { CollectionPanel } from './components/CollectionPanel'
import { JobDetail } from './components/JobDetail'
import { JobTable } from './components/JobTable'
import { OpsHeader } from './components/OpsHeader'
import { panelClasses } from './components/panel-classes'
import { QueuePanel } from './components/QueuePanel'
import { useJobs } from './ops-queries'

function JobsSection({
  selectedName,
  onSelect
}: {
  selectedName: string | undefined
  onSelect: (name: string) => void
}): React.JSX.Element | null {
  const jobs = useJobs()
  if (jobs.data === undefined) {
    if (!jobs.isError) {
      return null
    }

    return (
      <section aria-label="job" className={panelClasses.box}>
        <h2 className={panelClasses.heading}>Job</h2>
        <p role="alert" className={panelClasses.empty}>
          job 목록을 읽지 못했습니다.
        </p>
      </section>
    )
  }
  const { jobs: list } = jobs.data
  const now = new Date(jobs.dataUpdatedAt)
  const selected = list.find(({ name }) => name === selectedName) ?? list[0]

  return (
    <>
      <JobTable jobs={list} selectedName={selected?.name} now={now} onSelect={onSelect} />
      {selected !== undefined && <JobDetail job={selected} now={now} />}
    </>
  )
}

export function OpsScreen(): React.JSX.Element {
  const queryClient = useQueryClient()
  const jobs = useJobs()
  const [selectedName, setSelectedName] = useState<string>()
  const readAt = jobs.data !== undefined ? new Date(jobs.dataUpdatedAt) : undefined

  function handleRefresh(): void {
    queryClient.invalidateQueries()
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-canvas pb-12 font-sans text-sm text-fg">
      <OpsHeader workerSeenAt={jobs.data?.workerSeenAt} readAt={readAt} onRefresh={handleRefresh} />
      <main className="page page-wide mt-6 flex flex-col gap-4 px-4">
        <JobsSection selectedName={selectedName} onSelect={setSelectedName} />
        <div className="grid grid-cols-2 items-start gap-4 max-[800px]:grid-cols-1">
          <QueuePanel />
          <CollectionPanel />
        </div>
        <BatchKeyPanel />
      </main>
    </div>
  )
}
