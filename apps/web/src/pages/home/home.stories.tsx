import type { Meta, StoryObj } from '@storybook/react-vite'
import { CHARACTER_SERVER_NAMES, characterImageUrl } from '#core/character/character-summary'
import { StoryFrame } from '../../testing/story-support/StoryFrame'
import { storyRankedCharacters } from '../../testing/story-support/story-characters'
import { createStoryClientHost } from '../../testing/story-support/story-host'
import { CharacterSearchScreen } from '../character-search/CharacterSearchScreen'
import { NotFoundPage } from '../not-found/NotFoundPage'
import { TermsPage } from '../legal/LegalPage'
import { HomePage } from './HomePage'

const meta = {
  title: 'Screens/메인',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const characters = storyRankedCharacters(10)

const rankingHost = createStoryClientHost({
  getFameRanking: async () => ({ characters })
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

function Screen({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="page mt-6">{children}</div>
}

export const 메인: Story = {
  render: () => (
    <StoryFrame host={rankingHost}>
      <Screen>
        <HomePage />
      </Screen>
    </StoryFrame>
  )
}

export const 메인받는중: Story = {
  render: () => (
    <StoryFrame>
      <Screen>
        <HomePage />
      </Screen>
    </StoryFrame>
  )
}

export const 캐릭터검색결과: Story = {
  render: () => (
    <StoryFrame host={searchHost}>
      <Screen>
        <CharacterSearchScreen query={{ characterName: '캐릭터', serverId: 'all' }} />
      </Screen>
    </StoryFrame>
  )
}

export const 약관: Story = {
  render: () => (
    <StoryFrame>
      <Screen>
        <TermsPage />
      </Screen>
    </StoryFrame>
  )
}

export const 없는주소: Story = {
  render: () => (
    <StoryFrame>
      <Screen>
        <NotFoundPage />
      </Screen>
    </StoryFrame>
  )
}
