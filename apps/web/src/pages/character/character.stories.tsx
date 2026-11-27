import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { CharacterHistory } from '#entities/character'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { oathCatalogFixture } from '#entities/catalog/api/oath-catalog.fixture'
import { oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
import { storyCharacterDetail, storyHistory, storySingleHistory } from './api/character.fixture'
import { characterDetailHandlers, characterDetailLoadingHandlers } from './api/character.handlers'
import type { CharacterTab } from './character-tabs'
import { CharacterDetailScreen } from './CharacterDetailScreen'

const meta = {
  title: 'Screens/캐릭터 상세',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

function Screen({
  initialTab,
  role = 'dealer'
}: {
  initialTab: CharacterTab
  role?: 'dealer' | 'buffer'
}): React.JSX.Element {
  const [tab, setTab] = useState(initialTab)
  const { serverId, characterId } = storyCharacterDetail(role).character

  return (
    <StoryScreen>
      <CharacterDetailScreen
        serverId={serverId}
        characterId={characterId}
        tab={tab}
        onTabChange={setTab}
      />
    </StoryScreen>
  )
}

function tabStory(
  tab: CharacterTab,
  role: 'dealer' | 'buffer' = 'dealer',
  history: CharacterHistory = storyHistory
): Story {
  return {
    parameters: {
      msw: [
        ...characterDetailHandlers(storyCharacterDetail(role), history),
        oathCatalogHandlers.catalog(oathCatalogFixture.characterDetail)
      ]
    },
    render: () => (
      <StoryFrame>
        <Screen initialTab={tab} role={role} />
      </StoryFrame>
    )
  }
}

export const 장비: Story = tabStory('equipment')

export const 서약: Story = tabStory('oath')

export const 스킬: Story = tabStory('skill')

export const 아바타: Story = tabStory('avatar')

export const 버프강화: Story = tabStory('buff', 'buffer')

export const 스탯: Story = tabStory('status')

export const 이력: Story = tabStory('history')

export const 이력하나: Story = tabStory('history', 'dealer', storySingleHistory)

export const 받는중: Story = {
  parameters: { msw: characterDetailLoadingHandlers('dealer') },
  render: () => (
    <StoryFrame>
      <Screen initialTab="equipment" />
    </StoryFrame>
  )
}
