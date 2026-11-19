import type { Meta, StoryObj } from '@storybook/react-vite'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { SiteFooter } from './SiteFooter'

// 상단 바 story와 같은 title을 써서 story id(patterns-상단-바와-검색창--푸터)를 그대로 둔다.
const meta = {
  title: 'Patterns/상단 바와 검색창',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const 푸터: Story = {
  render: () => (
    <StoryFrame>
      <SiteFooter />
    </StoryFrame>
  )
}
