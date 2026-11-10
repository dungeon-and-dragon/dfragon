import * as stylex from '@stylexjs/stylex'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CollectionPanel } from './components/CollectionPanel'
import { JobDetail } from './components/JobDetail'
import { JobTable } from './components/JobTable'
import { OpsHeader } from './components/OpsHeader'
import { panelStyles } from './components/panel.style'
import { QueuePanel } from './components/QueuePanel'
import { useJobs } from './ops-queries'
import { styles } from './OpsScreen.style'

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
      <section aria-label="job" {...stylex.props(panelStyles.box)}>
        <h2 {...stylex.props(panelStyles.heading)}>Job</h2>
        <p role="alert" {...stylex.props(panelStyles.empty)}>
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
    <div {...stylex.props(styles.page)}>
      <OpsHeader workerSeenAt={jobs.data?.workerSeenAt} readAt={readAt} onRefresh={handleRefresh} />
      <main {...stylex.props(styles.main)}>
        <JobsSection selectedName={selectedName} onSelect={setSelectedName} />
        <div {...stylex.props(styles.queues)}>
          <QueuePanel />
          <CollectionPanel />
        </div>
      </main>
    </div>
  )
}
