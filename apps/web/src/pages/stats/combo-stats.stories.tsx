import type { Meta, StoryObj } from '@storybook/react-vite'
import { RANKING_JOBS } from '#entities/character'
import type { SetStatsFilter } from '#entities/ranking'
import { setStatsHandlers } from '#entities/ranking/api/set-stats.handlers'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { ComboStatsScreen } from './ComboStatsScreen'

const meta = {
  title: 'Screens/조합 통계',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const [slayer] = RANKING_JOBS
const TWO_HOURS = 2 * 60 * 60 * 1000

function ignoreFilterChange(): void {}

function Screen({ filter = {} }: { filter?: SetStatsFilter }): React.JSX.Element {
  return (
    <StoryFrame>
      <StoryScreen>
        <ComboStatsScreen filter={filter} onFilterChange={ignoreFilterChange} />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 조합통계: Story = {
  parameters: { msw: [setStatsHandlers.statsComputedAgo(TWO_HOURS)] },
  render: () => <Screen />
}

export const 직업고름: Story = {
  parameters: { msw: [setStatsHandlers.statsComputedAgo(TWO_HOURS)] },
  render: () => <Screen filter={{ jobId: slayer.jobId }} />
}

export const 비었을때: Story = {
  parameters: { msw: [setStatsHandlers.empty] },
  render: () => <Screen />
}

export const 받는중: Story = {
  parameters: { msw: [setStatsHandlers.loading] },
  render: () => <Screen />
}

export const 받지못함: Story = {
  parameters: { msw: [setStatsHandlers.failure] },
  render: () => <Screen />
}
