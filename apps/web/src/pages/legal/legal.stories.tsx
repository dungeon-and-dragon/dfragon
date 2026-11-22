import type { Meta, StoryObj } from '@storybook/react-vite'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { PrivacyPage, TermsPage } from './LegalPage'

// 메인 story와 같은 title을 써서 story id(screens-메인--약관)를 그대로 둔다.
const meta = {
  title: 'Screens/메인',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const 약관: Story = {
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <TermsPage />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 개인정보처리방침: Story = {
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <PrivacyPage />
      </StoryScreen>
    </StoryFrame>
  )
}
