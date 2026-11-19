import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { FameRankingFilter } from '#core/ranking'
import { oathCatalogFixture } from '#entities/catalog/api/oath-catalog.fixture'
import { oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
import { fameRankingHandlers } from '#entities/ranking/api/fame-ranking.handlers'
import { itemStatsHandlers } from '#entities/ranking/api/item-stats.handlers'
import { setStatsHandlers } from '#entities/ranking/api/set-stats.handlers'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { RANKING_JOBS } from './ranking-jobs'
import { RankingsScreen } from './RankingsScreen'

const meta = {
  title: 'Screens/랭킹',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const setHandlers = [
  setStatsHandlers.statsComputedAgo(0),
  itemStatsHandlers.statsComputedAgo(0),
  oathCatalogHandlers.catalog(oathCatalogFixture.setStats)
]
const pendingSetHandlers = [
  setStatsHandlers.loading,
  itemStatsHandlers.loading,
  oathCatalogHandlers.loading
]
const rankingPagesParameters = { msw: [fameRankingHandlers.pages, ...setHandlers] }

function Screen({ initialFilter = {} }: { initialFilter?: FameRankingFilter }): React.JSX.Element {
  const [filter, setFilter] = useState(initialFilter)

  return (
    <StoryFrame>
      <StoryScreen>
        <RankingsScreen filter={filter} onFilterChange={setFilter} />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 전체: Story = {
  parameters: rankingPagesParameters,
  render: () => <Screen />
}

export const 직업선택: Story = {
  parameters: rankingPagesParameters,
  render: () => <Screen initialFilter={{ jobId: RANKING_JOBS[0]!.jobId }} />
}

export const 세트선택: Story = {
  parameters: rankingPagesParameters,
  render: () => (
    <Screen
      initialFilter={{
        jobId: RANKING_JOBS[0]!.jobId,
        oathSetId: 16204,
        oathSetOption: '용투 : 용제 강림'
      }}
    />
  )
}

export const 아이템선택: Story = {
  parameters: rankingPagesParameters,
  render: () => (
    <Screen
      initialFilter={{
        jobId: RANKING_JOBS[0]!.jobId,
        itemIds: ['story-unique-1', 'story-weapon-1']
      }}
    />
  )
}

export const 거른랭킹없음: Story = {
  parameters: { msw: [fameRankingHandlers.empty, ...setHandlers] },
  render: () => <Screen initialFilter={{ oathSetId: 16204 }} />
}

export const 받는중: Story = {
  parameters: { msw: [fameRankingHandlers.loading, ...pendingSetHandlers] },
  render: () => <Screen />
}

export const 받지못함: Story = {
  parameters: { msw: [fameRankingHandlers.failure, ...pendingSetHandlers] },
  render: () => <Screen />
}
