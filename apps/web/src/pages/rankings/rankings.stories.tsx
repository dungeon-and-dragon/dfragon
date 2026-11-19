import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { FameRankingFilter } from '#core/ranking'
import { fameRankingHandlers } from '#entities/ranking/api/fame-ranking.handlers'
import type { ClientHost } from '#host/client-host'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { createStoryClientHost } from '#testing/story-support/story-host'
import { storyItemStats } from '#testing/story-support/story-item-stats'
import { storySetOathCatalog, storySetStats } from '#testing/story-support/story-set-stats'
import { RANKING_JOBS } from './ranking-jobs'
import { RankingsScreen } from './RankingsScreen'

const meta = {
  title: 'Screens/랭킹',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const setHost = createStoryClientHost({
  getSetStats: async () => storySetStats(new Date().toISOString()),
  getItemStats: async () => storyItemStats(new Date().toISOString()),
  getOathCatalog: async () => storySetOathCatalog
})
const rankingPagesParameters = { msw: [fameRankingHandlers.pages] }

function Screen({
  host,
  initialFilter = {}
}: {
  host?: ClientHost
  initialFilter?: FameRankingFilter
}): React.JSX.Element {
  const [filter, setFilter] = useState(initialFilter)

  return (
    <StoryFrame host={host}>
      <StoryScreen>
        <RankingsScreen filter={filter} onFilterChange={setFilter} />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 전체: Story = {
  parameters: rankingPagesParameters,
  render: () => <Screen host={setHost} />
}

export const 직업선택: Story = {
  parameters: rankingPagesParameters,
  render: () => <Screen host={setHost} initialFilter={{ jobId: RANKING_JOBS[0]!.jobId }} />
}

export const 세트선택: Story = {
  parameters: rankingPagesParameters,
  render: () => (
    <Screen
      host={setHost}
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
      host={setHost}
      initialFilter={{
        jobId: RANKING_JOBS[0]!.jobId,
        itemIds: ['story-unique-1', 'story-weapon-1']
      }}
    />
  )
}

export const 거른랭킹없음: Story = {
  parameters: { msw: [fameRankingHandlers.empty] },
  render: () => <Screen host={setHost} initialFilter={{ oathSetId: 16204 }} />
}

export const 받는중: Story = {
  parameters: { msw: [fameRankingHandlers.loading] },
  render: () => <Screen />
}

export const 받지못함: Story = {
  parameters: { msw: [fameRankingHandlers.failure] },
  render: () => <Screen />
}
