import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ClientHost } from '../../host/client-host'
import { StoryFrame } from '../../testing/story-support/StoryFrame'
import { StoryScreen } from '../../testing/story-support/StoryScreen'
import { createStoryClientHost } from '../../testing/story-support/story-host'
import { storyCharacterStats } from '../../testing/story-support/story-stats'
import { StatsPage } from './StatsPage'

const meta = {
  title: 'Screens/통계',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const TWO_HOURS = 2 * 60 * 60 * 1000

const statsHost = createStoryClientHost({
  getCharacterStats: async () => {
    const computedAt = new Date(Date.now() - TWO_HOURS).toISOString()

    return storyCharacterStats(computedAt)
  }
})

const failedHost = createStoryClientHost({
  getCharacterStats: async () => {
    throw new Error('통계를 받지 못했습니다.')
  }
})

function Screen({ host }: { host?: ClientHost }): React.JSX.Element {
  return (
    <StoryFrame host={host}>
      <StoryScreen>
        <StatsPage />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 통계: Story = {
  render: () => <Screen host={statsHost} />
}

export const 받는중: Story = {
  render: () => <Screen />
}

export const 받지못함: Story = {
  render: () => <Screen host={failedHost} />
}
