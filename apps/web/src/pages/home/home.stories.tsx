import type { Meta, StoryObj } from '@storybook/react-vite'
import { fameRankingHandlers } from '#entities/ranking/api/fame-ranking.handlers'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { HomePage } from './HomePage'

const meta = {
  title: 'Screens/메인',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const 메인: Story = {
  parameters: { msw: [fameRankingHandlers.pages] },
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <HomePage />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 메인받는중: Story = {
  parameters: { msw: [fameRankingHandlers.loading] },
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <HomePage />
      </StoryScreen>
    </StoryFrame>
  )
}
