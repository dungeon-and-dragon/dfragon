import { type ReactNode, useState } from 'react'
import { RowBars } from '#shared/ui/chart/RowBars'
import { ListBox } from '#shared/ui/ListBox'
import {
  type SkillWindow,
  type SkillWindowCatalog,
  skillWindowByPicks,
  useSkillWindowCatalog
} from '#entities/catalog'
import {
  type SetStatsFilter,
  type SkillStats,
  useItemStats,
  useSetStats,
  useSkillStats
} from '#entities/ranking'
import {
  SkillChainPanel,
  SkillChainRates,
  SkillUpgradeRates,
  SkillWindowColumns,
  SkillWindowGrid
} from '#widgets/skill-window'
import { StatsTabs } from '#widgets/stats-tabs'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { ItemRowBars } from './ItemRowBars'
import { formatHeadcount, uniqueItemBars, weaponBars } from './item-stats-bars'
import { comboBars, formatShare } from './set-stats-bars'
import { SetStatsFilterBox } from './SetStatsFilterBox'
import {
  jobStatsFilterOf,
  type SkillStatsGrow,
  skillChainBoardOf,
  skillStatsGrowOf,
  skillStatsPickOf,
  skillUpgradeRateBoardOf
} from './skill-stats-board'
import { StatsNote } from './StatsNote'

const BAR_LIMIT = 5
// 900px 미만에서는 세 상자를 한 열로 쌓고, 세로로 쌓인 칸 사이에는 위 선을 긋는다.
const TOP_ROW =
  'section section-cols md:grid-cols-3 max-md:grid-cols-1 max-md:[&>*+*]:border-l-0 max-md:[&>*+*]:border-t max-md:[&>*+*]:border-line'
const COMBO_BOX = {
  name: '가장 많이 사용하는 조합',
  empty: '세트 통계가 없습니다.',
  failed: '세트 통계를 받지 못했습니다.'
} as const
const ITEM_MESSAGES = {
  empty: '아이템 통계가 없습니다.',
  failed: '아이템 통계를 받지 못했습니다.'
} as const
const WEAPON_BOX = { name: '무기', ...ITEM_MESSAGES } as const
const UNIQUE_BOX = { name: '유일 장비', ...ITEM_MESSAGES } as const
const SKILL_EMPTY = '스킬 통계가 없습니다.'
const SKILL_FAILED = '스킬 통계를 받지 못했습니다.'
const FEW_SAMPLES = '표본이 20명 미만입니다.'
const NO_CHAINS = '스킬 체인 조합이 없습니다.'

type SampledStats = Readonly<{ computedAt: string | null; sampleSize: number }>

type SkillStatsBoard = SkillStats &
  Readonly<{ catalog: SkillWindowCatalog; skillWindow: SkillWindow }>

const LOADING = { status: 'loading' } as const

function hasSample({ computedAt, sampleSize }: SampledStats): boolean {
  return computedAt !== null && sampleSize > 0
}

// 스킬 창 데이터를 받지 못했거나 그 전직의 배치가 없으면 스킬 창을 그릴 수 없어 통계를 받지 못한 것과 같이 보인다.
function boardResult(
  stats: LoadedResult<SkillStats>,
  catalog: LoadedResult<SkillWindowCatalog | null>,
  { grow }: SkillStatsGrow
): LoadedResult<SkillStatsBoard> {
  if (stats.status === 'error') {
    return stats
  }

  if (catalog.status === 'error') {
    return catalog
  }

  if (stats.status === 'loading' || catalog.status === 'loading') {
    return LOADING
  }

  const skillWindow =
    catalog.value !== null
      ? skillWindowByPicks(catalog.value, { jobGrowName: grow.name }, skillStatsPickOf(stats.value))
      : null

  if (catalog.value === null || skillWindow === null) {
    return { status: 'error', message: SKILL_FAILED }
  }

  return { status: 'success', value: { ...stats.value, catalog: catalog.value, skillWindow } }
}

function StatsBox<Stats extends SampledStats>({
  box,
  result,
  children
}: {
  box: Readonly<{ name: string; empty: string; failed: string }>
  result: LoadedResult<Stats>
  children: (stats: Stats) => ReactNode
}): React.JSX.Element {
  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true">
          <div aria-hidden="true">
            <ListBox name={box.name}>
              <span className="skeleton h-[160px]" />
            </ListBox>
          </div>
        </div>
      )
    case 'error':
      return (
        <ListBox name={box.name}>
          <p role="alert" className="state state-error">
            {box.failed}
          </p>
        </ListBox>
      )
    case 'success':
      return (
        <ListBox name={box.name}>
          {hasSample(result.value) ? children(result.value) : <p className="state">{box.empty}</p>}
        </ListBox>
      )
  }
}

function SkillChainContent({
  board,
  grow
}: {
  board: SkillStatsBoard
  grow: SkillStatsGrow
}): React.JSX.Element {
  const chains = skillChainBoardOf(board, board.catalog, grow.grow)
  switch (chains.status) {
    case 'few-samples':
      return <p className="state">{FEW_SAMPLES}</p>
    case 'no-chains':
      return <p className="state">{NO_CHAINS}</p>
    case 'rates':
      return <SkillChainRates chains={chains.chains} />
  }
}

function SkillUpgradeContent({ board }: { board: SkillStatsBoard }): React.JSX.Element | null {
  const upgrades = skillUpgradeRateBoardOf(board, board.catalog, board.skillWindow)

  if (upgrades === null) {
    return null
  }

  return <SkillUpgradeRates {...upgrades} marks={board.catalog.marks} />
}

type SkillColumns = Readonly<{ main: ReactNode; side: ReactNode }>

function skillColumnsOf(
  result: LoadedResult<SkillStatsBoard>,
  grow: SkillStatsGrow,
  now: number
): SkillColumns {
  switch (result.status) {
    case 'loading':
      return {
        main: (
          <div aria-busy="true">
            <span aria-hidden="true" className="skeleton h-[480px]" />
          </div>
        ),
        side: (
          <div aria-busy="true">
            <div aria-hidden="true">
              <SkillChainPanel>
                <span className="skeleton h-[280px]" />
              </SkillChainPanel>
            </div>
          </div>
        )
      }
    case 'error':
      return {
        main: (
          <p role="alert" className="state state-error">
            {SKILL_FAILED}
          </p>
        ),
        side: null
      }
    case 'success': {
      const board = result.value

      if (!hasSample(board)) {
        return { main: <p className="state">{SKILL_EMPTY}</p>, side: null }
      }

      const source = {
        stats: board,
        role: grow.statsJob.role,
        marks: board.catalog.marks,
        now,
        pointsOwnLevel: false
      }

      return {
        main: <SkillWindowGrid skillWindow={board.skillWindow} source={source} />,
        side: (
          <>
            <SkillChainPanel>
              <SkillChainContent board={board} grow={grow} />
            </SkillChainPanel>
            <SkillUpgradeContent board={board} />
          </>
        )
      }
    }
  }
}

export function JobStatsScreen({
  filter,
  onFilterChange
}: {
  filter: SetStatsFilter
  onFilterChange: (filter: SetStatsFilter) => void
}): React.JSX.Element {
  const grow = skillStatsGrowOf(filter)
  const statsFilter = jobStatsFilterOf(filter)
  const setStats = useSetStats(statsFilter)
  const itemStats = useItemStats(statsFilter)
  const skillStats = useSkillStats(grow.statsJob)
  const catalog = useSkillWindowCatalog(grow.job.name)
  const [now] = useState(Date.now)
  const skill = skillColumnsOf(boardResult(skillStats, catalog, grow), grow, now)

  return (
    <div className="flex flex-col">
      <StatsTabs />
      <SetStatsFilterBox filter={statsFilter} onFilterChange={onFilterChange} growRequired />
      <div className={TOP_ROW}>
        <StatsBox box={COMBO_BOX} result={setStats}>
          {(stats) => (
            <RowBars
              bars={comboBars(stats, statsFilter).slice(0, BAR_LIMIT)}
              tone="chart-3"
              formatValue={formatShare}
            />
          )}
        </StatsBox>
        <StatsBox box={WEAPON_BOX} result={itemStats}>
          {(stats) => (
            <ItemRowBars
              bars={weaponBars(stats, statsFilter).slice(0, BAR_LIMIT)}
              tone="chart-2"
              formatValue={formatShare}
            />
          )}
        </StatsBox>
        <StatsBox box={UNIQUE_BOX} result={itemStats}>
          {(stats) => (
            <ItemRowBars
              bars={uniqueItemBars(stats, statsFilter)}
              tone="chart-5"
              formatValue={formatHeadcount}
            />
          )}
        </StatsBox>
      </div>
      <SkillWindowColumns sideWidth="wide" main={skill.main} side={skill.side} />
      {setStats.status === 'success' && setStats.value.computedAt !== null && (
        <StatsNote count={setStats.value.sampleSize} computedAt={setStats.value.computedAt} />
      )}
    </div>
  )
}
