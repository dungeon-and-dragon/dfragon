import type { Meta, StoryObj } from '@storybook/react-vite'
import { HttpResponse, http } from 'msw'
import { CHARACTER_SERVER_NAMES, characterImageUrl } from '#entities/character'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { storyRankedCharacters } from '#entities/ranking/api/ranked-characters.fixture'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { CharacterSearchScreen } from './CharacterSearchScreen'

// 메인 story와 같은 title을 써서 story id(screens-메인--캐릭터검색결과)를 그대로 둔다.
const meta = {
  title: 'Screens/메인',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const searchedCharacters = storyRankedCharacters(4).map((character) => {
  const adventureName = character.rank % 2 === 0 ? character.adventureName : null
  const imageUrl = characterImageUrl(character)

  return {
    serverId: character.serverId,
    characterId: character.characterId,
    characterName: '캐릭터',
    serverName: CHARACTER_SERVER_NAMES[character.serverId],
    fame: character.fame,
    imageUrl,
    adventureName,
    jobName: character.jobName,
    jobGrowName: character.jobGrowName
  }
})
const searchHandler = http.get(`${API_BASE_URL}/characters`, () =>
  HttpResponse.json({ rows: searchedCharacters })
)

export const 캐릭터검색결과: Story = {
  parameters: { msw: [searchHandler] },
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <CharacterSearchScreen query={{ characterName: '캐릭터', serverId: 'all' }} />
      </StoryScreen>
    </StoryFrame>
  )
}
