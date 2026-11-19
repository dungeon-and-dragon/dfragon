import type { Meta, StoryObj } from '@storybook/react-vite'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { storyRankedCharacters } from '#testing/story-support/story-characters'
import { createStoryClientHost } from '#testing/story-support/story-host'
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

const host = createStoryClientHost({
  getTodayGrade: async () => ({ percent: 13, expiresAt: '2999-01-01T00:00:00.000Z' })
})
const rows = storyRankedCharacters(4)

export const 화면틀: Story = {
  render: () => (
    <StoryFrame host={host}>
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
