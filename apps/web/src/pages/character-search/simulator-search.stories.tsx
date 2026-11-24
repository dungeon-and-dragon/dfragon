import type { Meta, StoryObj } from '@storybook/react-vite'
import { HttpResponse, http } from 'msw'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { searchedCharacterRow } from './api/character-search.fixture'
import { CHARACTER_SEARCH_URL } from './api/character-search.handlers'
import { SimulatorSearchScreen } from './SimulatorSearchScreen'

const meta = {
  title: 'Screens/장비 시뮬레이터',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const searchHandler = http.get(CHARACTER_SEARCH_URL, () =>
  HttpResponse.json({
    rows: [
      searchedCharacterRow({
        serverId: 'cain',
        characterId: 'simulator-1',
        characterName: '캐릭터'
      }),
      searchedCharacterRow({
        characterId: 'simulator-2',
        characterName: '캐릭터',
        adventureName: '모험단'
      })
    ]
  })
)

export const 검색전: Story = {
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <SimulatorSearchScreen query={{ characterName: '', serverId: 'all' }} />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 캐릭터찾기: Story = {
  parameters: { msw: [searchHandler] },
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <SimulatorSearchScreen query={{ characterName: '캐릭터', serverId: 'all' }} />
      </StoryScreen>
    </StoryFrame>
  )
}
