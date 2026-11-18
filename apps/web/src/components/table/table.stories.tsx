import type { Meta, StoryObj } from '@storybook/react-vite'
import { StoryFrame } from '../../testing/story-support/StoryFrame'
import { storyRankedCharacters } from '../../testing/story-support/story-characters'
import { CharacterTable, SkeletonRow } from './CharacterTable'
import { ListBox } from './ListBox'
import { TitleBox, TitleStat } from './TitleBox'

const meta = {
  title: 'Patterns/표',
  decorators: [
    (Story) => (
      <StoryFrame>
        <div className="w-page max-w-full">
          <Story />
        </div>
      </StoryFrame>
    )
  ]
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const rows = storyRankedCharacters(10)

export const 캐릭터표: Story = {
  render: () => (
    <ListBox name="명성 랭킹">
      <CharacterTable rows={rows} />
    </ListBox>
  )
}

export const 순위없음: Story = {
  render: () => (
    <ListBox name="길드원">
      <CharacterTable rows={rows.slice(0, 5)} ranked={false} affiliations={['adventure']} />
    </ListBox>
  )
}

export const 받는중: Story = {
  render: () => (
    <ListBox name="명성 랭킹">
      <CharacterTable
        rows={[]}
        trailing={Array.from({ length: 5 }, (_, index) => <SkeletonRow key={index} />)}
      />
    </ListBox>
  )
}

export const 제목상자: Story = {
  render: () => (
    <TitleBox title="길드1">
      <TitleStat label="길드원" value="48" />
      <TitleStat label="평균 명성" value="128,512" />
    </TitleBox>
  )
}
