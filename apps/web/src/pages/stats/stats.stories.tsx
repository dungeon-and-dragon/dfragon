import type { Meta, StoryObj } from '@storybook/react-vite'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { characterStatsHandlers } from './api/stats.handlers'
import { StatsPage } from './StatsPage'

const meta = {
  title: 'Screens/통계',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

function Screen(): React.JSX.Element {
  return (
    <StoryFrame>
      <StoryScreen>
        <StatsPage />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 통계: Story = {
  parameters: { msw: [characterStatsHandlers.stats] },
  render: () => <Screen />
}

export const 받는중: Story = {
  parameters: { msw: [characterStatsHandlers.loading] },
  render: () => <Screen />
}

export const 받지못함: Story = {
  parameters: { msw: [characterStatsHandlers.failure] },
  render: () => <Screen />
}
