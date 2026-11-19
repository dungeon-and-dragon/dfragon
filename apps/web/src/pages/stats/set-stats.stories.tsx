import type { Meta, StoryObj } from '@storybook/react-vite'
import type { SetStatsFilter } from '#core/ranking'
import type { ClientHost } from '#host/client-host'
import { RANKING_JOBS } from '#pages/rankings'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { createStoryClientHost } from '#testing/story-support/story-host'
import { storyItemStats } from '#testing/story-support/story-item-stats'
import { storySetOathCatalog, storySetStats } from '#testing/story-support/story-set-stats'
import { SetStatsScreen } from './SetStatsScreen'

const meta = {
  title: 'Screens/세트 통계',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const TWO_HOURS = 2 * 60 * 60 * 1000
const [slayer] = RANKING_JOBS

const statsHost = createStoryClientHost({
  getSetStats: async () => storySetStats(new Date(Date.now() - TWO_HOURS).toISOString()),
  getItemStats: async () => storyItemStats(new Date(Date.now() - TWO_HOURS).toISOString()),
  getOathCatalog: async () => storySetOathCatalog
})

const emptyHost = createStoryClientHost({
  getSetStats: async () => ({
    computedAt: null,
    sampleSize: 0,
    equipmentSets: [],
    oathSets: [],
    combos: []
  }),
  getItemStats: async () => ({ computedAt: null, sampleSize: 0, slots: [] }),
  getOathCatalog: async () => storySetOathCatalog
})

const failedHost = createStoryClientHost({
  getSetStats: async () => {
    throw new Error('세트 통계를 받지 못했습니다.')
  },
  getOathCatalog: async () => storySetOathCatalog
})

function ignoreFilterChange(): void {}

function Screen({
  host,
  filter = {}
}: {
  host?: ClientHost
  filter?: SetStatsFilter
}): React.JSX.Element {
  return (
    <StoryFrame host={host}>
      <StoryScreen>
        <SetStatsScreen filter={filter} onFilterChange={ignoreFilterChange} />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 세트통계: Story = {
  render: () => <Screen host={statsHost} />
}

export const 직업고름: Story = {
  render: () => <Screen host={statsHost} filter={{ jobId: slayer.jobId }} />
}

export const 비었을때: Story = {
  render: () => <Screen host={emptyHost} />
}

export const 받는중: Story = {
  render: () => <Screen />
}

export const 받지못함: Story = {
  render: () => <Screen host={failedHost} />
}
