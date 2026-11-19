import type { Meta, StoryObj } from '@storybook/react-vite'
import { HttpResponse, http } from 'msw'
import { CHARACTER_SERVER_NAMES, characterImageUrl } from '#entities/character'
import { fameRankingHandlers } from '#entities/ranking/api/fame-ranking.handlers'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { storyRankedCharacters } from '#testing/story-support/story-characters'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { CharacterSearchScreen } from '#pages/character-search'
import { NotFoundPage } from '#pages/not-found'
import { TermsPage } from '#pages/legal'
import { HomePage } from './HomePage'

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

export const 메인: Story = {
  parameters: { msw: [fameRankingHandlers.pages] },
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <HomePage />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 메인받는중: Story = {
  parameters: { msw: [fameRankingHandlers.loading] },
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <HomePage />
      </StoryScreen>
    </StoryFrame>
  )
}

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

export const 약관: Story = {
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <TermsPage />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 없는주소: Story = {
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <NotFoundPage />
      </StoryScreen>
    </StoryFrame>
  )
}
