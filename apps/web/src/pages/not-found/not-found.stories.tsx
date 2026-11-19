import type { Meta, StoryObj } from '@storybook/react-vite'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { NotFoundPage } from './NotFoundPage'

// 메인 story와 같은 title을 써서 story id(screens-메인--없는주소)를 그대로 둔다.
const meta = {
  title: 'Screens/메인',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const 없는주소: Story = {
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <NotFoundPage />
      </StoryScreen>
    </StoryFrame>
  )
}
