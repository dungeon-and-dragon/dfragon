import type { Meta, StoryObj } from '@storybook/react-vite'
import { itemStatsHandlers } from '#entities/ranking/api/item-stats.handlers'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { itemDetailHandlers } from '#widgets/item-tooltip/api/item-detail.handlers'
import { WeaponStatsScreen } from './WeaponStatsScreen'

const meta = {
  title: 'Screens/무기 통계',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const TWO_HOURS = 2 * 60 * 60 * 1000

function ignoreFilterChange(): void {}

function Screen(): React.JSX.Element {
  return (
    <StoryFrame>
      <StoryScreen>
        <WeaponStatsScreen filter={{}} onFilterChange={ignoreFilterChange} />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 무기통계: Story = {
  parameters: { msw: [itemStatsHandlers.statsComputedAgo(TWO_HOURS), itemDetailHandlers.detail] },
  render: () => <Screen />
}

export const 비었을때: Story = {
  parameters: { msw: [itemStatsHandlers.empty] },
  render: () => <Screen />
}

export const 받는중: Story = {
  parameters: { msw: [itemStatsHandlers.loading] },
  render: () => <Screen />
}
