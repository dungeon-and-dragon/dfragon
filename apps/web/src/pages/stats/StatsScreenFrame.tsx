import type { ReactNode } from 'react'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import type { SetStatsFilter } from '#entities/ranking'
import { SetStatsFilterBox } from './SetStatsFilterBox'
import { StatsNote } from './StatsNote'
import { StatsTabs } from '#widgets/stats-tabs'

type SampledStats = Readonly<{ computedAt: string | null; sampleSize: number }>

type StatsMessages = Readonly<{ empty: string; failed: string }>

export function StatsScreenFrame<Stats extends SampledStats>({
  result,
  filter,
  onFilterChange,
  skeleton,
  messages,
  children
}: {
  result: LoadedResult<Stats>
  filter: SetStatsFilter
  onFilterChange: (filter: SetStatsFilter) => void
  skeleton: React.JSX.Element
  messages: StatsMessages
  children: (stats: Stats) => ReactNode
}): React.JSX.Element {
  const filterBox = <SetStatsFilterBox filter={filter} onFilterChange={onFilterChange} />

  return (
    <div className="flex flex-col">
      <StatsTabs />
      <StatsBody result={result} filterBox={filterBox} skeleton={skeleton} messages={messages}>
        {children}
      </StatsBody>
    </div>
  )
}

function StatsBody<Stats extends SampledStats>({
  result,
  filterBox,
  skeleton,
  messages,
  children
}: {
  result: LoadedResult<Stats>
  filterBox: React.JSX.Element
  skeleton: React.JSX.Element
  messages: StatsMessages
  children: (stats: Stats) => ReactNode
}): React.JSX.Element {
  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true">
          {filterBox}
          <div aria-hidden="true">{skeleton}</div>
        </div>
      )
    case 'error':
      return (
        <>
          {filterBox}
          <p role="alert" className="section state state-error">
            {messages.failed}
          </p>
        </>
      )
    case 'success': {
      const stats = result.value
      const { computedAt } = stats
      const empty = computedAt === null || stats.sampleSize === 0

      return (
        <>
          {filterBox}
          {empty ? <p className="section state">{messages.empty}</p> : children(stats)}
          {computedAt !== null && <StatsNote count={stats.sampleSize} computedAt={computedAt} />}
        </>
      )
    }
  }
}
