import { useState } from 'react'
import {
  type SkillWindow,
  type SkillWindowCatalog,
  skillWindowByPicks,
  useSkillWindowCatalog
} from '#entities/catalog'
import { type FameRankingFilter, type SkillStats, useSkillStats } from '#entities/ranking'
import { RankingFilterBox } from '#widgets/ranking-filter'
import {
  SkillChainPanel,
  SkillChainRates,
  SkillWindowColumns,
  SkillWindowGrid
} from '#widgets/skill-window'
import { StatsTabs } from '#widgets/stats-tabs'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import {
  type SkillStatsGrow,
  skillChainBoardOf,
  skillStatsGrowOf,
  skillStatsPickOf
} from './skill-stats-board'
import { StatsBody } from './StatsScreenFrame'

const PICK_GROW = '전직을 고르세요.'
const EMPTY = '스킬 통계가 없습니다.'
const FAILED = '스킬 통계를 받지 못했습니다.'
const FEW_SAMPLES = '표본이 20명 미만입니다.'
const NO_CHAINS = '스킬 체인 조합이 없습니다.'

type SkillStatsBoard = SkillStats &
  Readonly<{ catalog: SkillWindowCatalog; skillWindow: SkillWindow }>

const LOADING = { status: 'loading' } as const

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
    return { status: 'error', message: FAILED }
  }

  return { status: 'success', value: { ...stats.value, catalog: catalog.value, skillWindow } }
}

function SkillStatsSkeleton(): React.JSX.Element {
  return (
    <SkillWindowColumns
      main={<span className="skeleton h-[480px]" />}
      side={
        <SkillChainPanel>
          <span className="skeleton h-[280px]" />
        </SkillChainPanel>
      }
    />
  )
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

function SkillStatsBody({
  grow,
  filterBox
}: {
  grow: SkillStatsGrow
  filterBox: React.JSX.Element
}): React.JSX.Element {
  const stats = useSkillStats(grow.statsJob)
  const catalog = useSkillWindowCatalog(grow.job.name)
  const [now] = useState(Date.now)

  return (
    <StatsBody
      result={boardResult(stats, catalog, grow)}
      filterBox={filterBox}
      skeleton={<SkillStatsSkeleton />}
      messages={{ empty: EMPTY, failed: FAILED }}
    >
      {(board) => {
        const source = {
          stats: board,
          role: grow.statsJob.role,
          marks: board.catalog.marks,
          now,
          pointsOwnLevel: false
        }

        return (
          <SkillWindowColumns
            main={<SkillWindowGrid skillWindow={board.skillWindow} source={source} />}
            side={
              <SkillChainPanel>
                <SkillChainContent board={board} grow={grow} />
              </SkillChainPanel>
            }
          />
        )
      }}
    </StatsBody>
  )
}

export function SkillStatsScreen({
  filter,
  onFilterChange
}: {
  filter: FameRankingFilter
  onFilterChange: (filter: FameRankingFilter) => void
}): React.JSX.Element {
  const grow = skillStatsGrowOf(filter)
  const filterBox = <RankingFilterBox filter={filter} onChange={onFilterChange} />

  return (
    <div className="flex flex-col">
      <StatsTabs />
      {grow !== null ? (
        <SkillStatsBody grow={grow} filterBox={filterBox} />
      ) : (
        <>
          {filterBox}
          <p className="section state">{PICK_GROW}</p>
        </>
      )}
    </div>
  )
}
