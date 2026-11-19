import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { FameRankingFilter } from '#core/ranking'
import type { ClientHost } from '#host/client-host'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { storyRankedCharacters } from '#testing/story-support/story-characters'
import { createStoryClientHost } from '#testing/story-support/story-host'
import { storySetOathCatalog, storySetStats } from '#testing/story-support/story-set-stats'
import { RANKING_JOBS } from './ranking-jobs'
import { RankingsScreen } from './RankingsScreen'

const meta = {
  title: 'Screens/랭킹',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const PAGE_SIZE = 100
const characters = storyRankedCharacters(PAGE_SIZE + 30)
const SECOND_PAGE = 'story-page-2'
const setHosts = {
  getSetStats: async () => storySetStats(new Date().toISOString()),
  getOathCatalog: async () => storySetOathCatalog
}

const rankingHost = createStoryClientHost({
  getFameRanking: async (_filter, cursor) => {
    if (cursor === SECOND_PAGE) {
      return { characters: characters.slice(PAGE_SIZE), nextCursor: null }
    }

    return { characters: characters.slice(0, PAGE_SIZE), nextCursor: SECOND_PAGE }
  },
  ...setHosts
})

const emptyHost = createStoryClientHost({
  getFameRanking: async () => ({ characters: [], nextCursor: null }),
  ...setHosts
})

const failedHost = createStoryClientHost({
  getFameRanking: async () => {
    throw new Error('랭킹을 받지 못했습니다.')
  }
})

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
  render: () => <Screen host={rankingHost} />
}

export const 직업선택: Story = {
  render: () => <Screen host={rankingHost} initialFilter={{ jobId: RANKING_JOBS[0]!.jobId }} />
}

export const 세트선택: Story = {
  render: () => (
    <Screen
      host={rankingHost}
      initialFilter={{
        jobId: RANKING_JOBS[0]!.jobId,
        oathSetId: 16204,
        oathSetOption: '용투 : 용제 강림'
      }}
    />
  )
}

export const 거른랭킹없음: Story = {
  render: () => <Screen host={emptyHost} initialFilter={{ oathSetId: 16204 }} />
}

export const 받는중: Story = {
  render: () => <Screen />
}

export const 받지못함: Story = {
  render: () => <Screen host={failedHost} />
}
