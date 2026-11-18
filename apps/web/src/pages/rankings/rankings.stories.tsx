import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { FameRankingFilter } from '#core/ranking'
import type { ClientHost } from '../../host/client-host'
import { StoryFrame } from '../../testing/story-support/StoryFrame'
import { StoryScreen } from '../../testing/story-support/StoryScreen'
import { storyRankedCharacters } from '../../testing/story-support/story-characters'
import { createStoryClientHost } from '../../testing/story-support/story-host'
import { RANKING_JOBS } from './ranking-jobs'
import { RankingsScreen } from './RankingsScreen'

const meta = {
  title: 'Screens/랭킹',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const characters = storyRankedCharacters(100)

const rankingHost = createStoryClientHost({
  getFameRanking: async () => ({ characters })
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

export const 받는중: Story = {
  render: () => <Screen />
}

export const 받지못함: Story = {
  render: () => <Screen host={failedHost} />
}
