import type { Meta, StoryObj } from '@storybook/react-vite'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { todayGradeHandlers } from '#widgets/global-bar/api/today-grade.handlers'
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

// 첫 화면이 아닌 화면은 전역 바에 검색창을 함께 둔다.
export const 검색창있는상단바: Story = {
  parameters: { msw: [todayGradeHandlers.grade(13)] },
  render: () => (
    <StoryFrame path="/rankings">
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
