import { Tabs } from '@dfragon/ui'
import { useQueryClient } from '@tanstack/react-query'
import { BatchKeyPanel } from '#ops-components/BatchKeyPanel'
import { CollectionPanel } from '#ops-components/CollectionPanel'
import { JobTable } from '#ops-components/JobTable'
import { LabItemPanel } from '#ops-components/LabItemPanel'
import { OpsHeader } from '#ops-components/OpsHeader'
import { panelClasses } from '#ops-components/panel-classes'
import { QueuePanel } from '#ops-components/QueuePanel'
import { RunHistory } from '#ops-components/RunHistory'
import { useJobs } from './ops-queries'

// 탭 줄은 구획 하나로 두고, 패널 안의 구획이 각자 가로 선을 긋도록 Root와 Panel은 구획 class를 두지 않는다.
const TAB_LIST = 'px-1 shadow-none'
const TAB_PANEL = 'flex flex-col focus-ring-inset'

function JobsSection(): React.JSX.Element | null {
  const jobs = useJobs()
  if (jobs.data === undefined) {
    if (!jobs.isError) {
      return null
    }

    return (
      <section aria-label="job" className={panelClasses.box}>
        <h2 className="section-title">Job</h2>
        <p role="alert" className="state state-error">
          job 목록을 읽지 못했습니다.
        </p>
      </section>
    )
  }
  const { jobs: list } = jobs.data
  const now = new Date(jobs.dataUpdatedAt)

  return (
    <>
      <JobTable jobs={list} now={now} />
      <RunHistory jobs={list} now={now} />
    </>
  )
}

export function OpsScreen(): React.JSX.Element {
  const queryClient = useQueryClient()
  const jobs = useJobs()
  const readAt = jobs.data !== undefined ? new Date(jobs.dataUpdatedAt) : undefined

  function handleRefresh(): void {
    queryClient.invalidateQueries()
  }

  return (
    <div className="flex min-h-dvh flex-col items-center overflow-x-clip bg-canvas font-sans text-sm text-fg">
      <OpsHeader workerSeenAt={jobs.data?.workerSeenAt} readAt={readAt} onRefresh={handleRefresh} />
      <main className="page page-wide screen">
        <CollectionPanel />
        <Tabs.Root defaultValue="jobs" className="flex flex-col">
          {/* 탭 줄은 넘치면 스스로 스크롤해 그 안에 그린 구획 선이 잘리므로, 구획은 탭 줄을 감싼 상자가 맡는다.
              구획 선과 겹쳐 2px가 되지 않게 탭 줄 자신의 아래 선은 지운다. */}
          <div className="section shrink-0 py-0">
            <Tabs.List aria-label="운영" render={<div className={TAB_LIST} />}>
              <Tabs.Tab value="jobs">Job</Tabs.Tab>
              <Tabs.Tab value="queues">타임라인 queue</Tabs.Tab>
              <Tabs.Tab value="batch-keys">batch key</Tabs.Tab>
              <Tabs.Tab value="lab-items">실험실 아이템</Tabs.Tab>
            </Tabs.List>
          </div>
          <Tabs.Panel value="jobs" className={TAB_PANEL}>
            <JobsSection />
          </Tabs.Panel>
          <Tabs.Panel value="queues" className={TAB_PANEL}>
            <QueuePanel />
          </Tabs.Panel>
          <Tabs.Panel value="batch-keys" className={TAB_PANEL}>
            <BatchKeyPanel />
          </Tabs.Panel>
          <Tabs.Panel value="lab-items" className={TAB_PANEL}>
            <LabItemPanel />
          </Tabs.Panel>
        </Tabs.Root>
      </main>
    </div>
  )
}
