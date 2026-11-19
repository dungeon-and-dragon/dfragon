import type { Meta, StoryObj } from '@storybook/react-vite'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { storyRankedCharacters } from '#testing/story-support/story-characters'
import { todayGradeHandlers } from '#testing/test-support/today-grade-handlers'
import { GlobalBar } from './GlobalBar'
import { CharacterTable } from './table/CharacterTable'
import { ListBox } from '#shared/ui/ListBox'
import { TitleBox, TitleStat } from '#shared/ui/TitleBox'

const meta = {
  title: 'Patterns/화면 틀',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const rows = storyRankedCharacters(4)

export const 화면틀: Story = {
  parameters: { msw: [todayGradeHandlers.grade(13)] },
  render: () => (
    <StoryFrame>
      <div className="flex min-h-screen flex-col overflow-x-clip">
        <GlobalBar />
        <main className="page screen bg-canvas">
          <TitleBox title="모험단1">
            <TitleStat label="캐릭터" value="24" />
            <TitleStat label="최고 명성" value="98,412" />
          </TitleBox>
          <ListBox name="캐릭터">
            <CharacterTable rows={rows} ranked={false} />
          </ListBox>
          <div className="section section-cols">
            <ListBox name="서버 인구" />
            <ListBox name="직업 분포" />
          </div>
        </main>
      </div>
    </StoryFrame>
  )
}
