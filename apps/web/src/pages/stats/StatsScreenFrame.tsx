import type { ReactNode } from 'react'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { RelativeTime } from '#shared/ui/RelativeTime'
import { ListBox } from '#shared/ui/ListBox'
import { TitleBox, TitleStat } from '#shared/ui/TitleBox'
import type { SetStatsFilter } from '#entities/ranking'
import { SetStatsFilterBox } from './SetStatsFilterBox'
import { StatsTabs } from './StatsTabs'

const integer = new Intl.NumberFormat('ko-KR')

type SampledStats = Readonly<{ computedAt: string | null; sampleSize: number }>

type StatsMessages = Readonly<{ empty: string; failed: string; loading: string }>

export function StatsScreenFrame<Stats extends SampledStats>({
  title,
  result,
  filter,
  onFilterChange,
  skeletonName,
  messages,
  children
}: {
  title: string
  result: LoadedResult<Stats>
  filter: SetStatsFilter
  onFilterChange: (filter: SetStatsFilter) => void
  skeletonName: string
  messages: StatsMessages
  children: (stats: Stats) => ReactNode
}): React.JSX.Element {
  const filterBox = <SetStatsFilterBox filter={filter} onFilterChange={onFilterChange} />

  return (
    <div className="flex flex-col">
      <StatsTabs />
      <StatsBody
        title={title}
        result={result}
        filterBox={filterBox}
        skeletonName={skeletonName}
        messages={messages}
      >
        {children}
      </StatsBody>
    </div>
  )
}

function StatsBody<Stats extends SampledStats>({
  title,
  result,
  filterBox,
  skeletonName,
  messages,
  children
}: {
  title: string
  result: LoadedResult<Stats>
  filterBox: React.JSX.Element
  skeletonName: string
  messages: StatsMessages
  children: (stats: Stats) => ReactNode
}): React.JSX.Element {
  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true">
          <span role="status" className="sr-only">
            {messages.loading}
          </span>
          <TitleBox title={title} />
          {filterBox}
          <div aria-hidden="true">
            <ListBox name={skeletonName}>
              <span className="skeleton h-[480px]" />
            </ListBox>
          </div>
        </div>
      )
    case 'error':
      return (
        <>
          <TitleBox title={title} />
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
          <TitleBox title={title}>
            {computedAt !== null && (
              <>
                <TitleStat label="캐릭터" value={integer.format(stats.sampleSize)} />
                <TitleStat
                  label="마지막 업데이트 시간"
                  value={<RelativeTime at={computedAt} />}
                  numeric={false}
                />
              </>
            )}
          </TitleBox>
          {filterBox}
          {empty ? <p className="section state">{messages.empty}</p> : children(stats)}
        </>
      )
    }
  }
}
