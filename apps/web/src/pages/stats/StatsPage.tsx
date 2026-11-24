import { Fragment } from 'react'
import { Columns } from '#shared/ui/chart/Columns'
import { type Bar, type BarTone, RowBars } from '#shared/ui/chart/RowBars'
import { ListBox } from '#shared/ui/ListBox'
import { StatsTabs } from '#widgets/stats-tabs'
import { useCharacterStats } from './api/useCharacterStats'
import { averageFameBars, type FameBar, fameBars, jobBars, serverBars } from '#entities/ranking'
import { StatsNote } from './StatsNote'

const SCREEN = 'flex flex-col'
const STAT_BOX_NAMES = {
  server: '서버 인구',
  fame: '명성 분포',
  job: '직업 분포',
  averageFame: '직업별 평균 명성'
} as const

type StatBoxId = keyof typeof STAT_BOX_NAMES
const STAT_BOX_ROWS: readonly (readonly StatBoxId[])[] = [
  ['server', 'fame'],
  ['job', 'averageFame']
]

export function StatsPage(): React.JSX.Element {
  return (
    <div className={SCREEN}>
      <StatsTabs />
      <CharacterStatsBody />
    </div>
  )
}

function CharacterStatsBody(): React.JSX.Element {
  const result = useCharacterStats()
  switch (result.status) {
    case 'loading':
      return <StatsSkeleton />
    case 'error':
      return (
        <div className={SCREEN}>
          <p role="alert" className="section state state-error">
            {result.message}
          </p>
        </div>
      )
    case 'success': {
      const stats = result.value
      const boxes: Record<StatBoxId, React.JSX.Element> = {
        server: <StatBox name={STAT_BOX_NAMES.server} bars={serverBars(stats)} />,
        fame: <FameBox bars={fameBars(stats)} />,
        job: <StatBox name={STAT_BOX_NAMES.job} bars={jobBars(stats)} />,
        averageFame: (
          <StatBox name={STAT_BOX_NAMES.averageFame} bars={averageFameBars(stats)} tone="fame" />
        )
      }

      return (
        <div className={SCREEN}>
          <StatsNote count={stats.total} computedAt={stats.computedAt} />
          {STAT_BOX_ROWS.map((row) => (
            <div key={row.join()} className="section section-cols">
              {row.map((id) => (
                <Fragment key={id}>{boxes[id]}</Fragment>
              ))}
            </div>
          ))}
        </div>
      )
    }
  }
}

function StatsSkeleton(): React.JSX.Element {
  return (
    <div aria-busy="true" className={SCREEN}>
      <div aria-hidden="true">
        {STAT_BOX_ROWS.map((row) => (
          <div key={row.join()} className="section section-cols">
            {row.map((id) => (
              <ListBox key={id} name={STAT_BOX_NAMES[id]}>
                <span className="skeleton h-[256px]" />
              </ListBox>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatBox({
  name,
  bars,
  tone
}: {
  name: string
  bars: readonly Bar[]
  tone?: BarTone
}): React.JSX.Element {
  if (bars.length === 0) {
    return <ListBox name={name} />
  }

  return (
    <ListBox name={name}>
      <RowBars bars={bars} tone={tone} barFromMd />
    </ListBox>
  )
}

function fameGroupsOf(bars: readonly FameBar[]): FameBar[][] {
  const coarse = bars.filter(({ fine }) => !fine)
  const fine = bars.filter(({ fine }) => fine)

  return [coarse, fine].filter((group) => group.length > 0)
}

function FameBox({ bars }: { bars: readonly FameBar[] }): React.JSX.Element {
  if (bars.length === 0) {
    return <ListBox name={STAT_BOX_NAMES.fame} />
  }

  return (
    <ListBox name={STAT_BOX_NAMES.fame} fillHeight>
      <Columns groups={fameGroupsOf(bars)} />
    </ListBox>
  )
}
