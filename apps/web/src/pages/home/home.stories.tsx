import type { Meta, StoryObj } from '@storybook/react-vite'
import { CHARACTER_SERVER_NAMES, characterImageUrl } from '#core/character'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { storyRankedCharacters } from '#testing/story-support/story-characters'
import { createStoryClientHost } from '#testing/story-support/story-host'
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

const characters = storyRankedCharacters(10)

const rankingHost = createStoryClientHost({
  getFameRanking: async () => ({ characters, nextCursor: null })
})

const searchHost = createStoryClientHost({
  searchCharacters: async () =>
    characters.slice(0, 4).map((character) => {
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
})

export const 메인: Story = {
  render: () => (
    <StoryFrame host={rankingHost}>
      <StoryScreen>
        <HomePage />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 메인받는중: Story = {
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <HomePage />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 캐릭터검색결과: Story = {
  render: () => (
    <StoryFrame host={searchHost}>
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
