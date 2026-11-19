import type { Meta, StoryObj } from '@storybook/react-vite'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { todayGradeHandlers } from '#testing/test-support/today-grade-handlers'
import { CharacterSearchBox } from './CharacterSearchBox'
import { GlobalBar } from './GlobalBar'
import { TodayGrade } from './TodayGrade'

const meta = {
  title: 'Patterns/상단 바와 검색창',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const 상단바: Story = {
  parameters: { msw: [todayGradeHandlers.grade(13)] },
  render: () => (
    <StoryFrame>
      <GlobalBar />
    </StoryFrame>
  )
}

export const 검색창: Story = {
  render: () => (
    <StoryFrame>
      <div className="flex flex-col gap-6 p-6">
        <CharacterSearchBox />
        <CharacterSearchBox size="large" />
      </div>
    </StoryFrame>
  )
}

export const 오늘등급: Story = {
  render: () => (
    <div className="flex items-center gap-6 p-6">
      <TodayGrade grade={null} />
      <TodayGrade grade={13} />
      <TodayGrade grade={62} />
      <TodayGrade grade={92} />
      <TodayGrade grade={98} />
    </div>
  )
}
