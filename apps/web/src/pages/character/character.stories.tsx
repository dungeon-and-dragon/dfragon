import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { SkillWindowCatalog } from '#core/catalog/skill-window'
import type { ClientHost } from '../../host/client-host'
import { StoryFrame } from '../../testing/story-support/StoryFrame'
import {
  storyBuffSkillWindowCatalog,
  storyCharacterDetail,
  storyHistory,
  storyOathCatalog,
  storySkillWindowCatalog,
  storyTimeline
} from '../../testing/story-support/story-character-detail'
import { createStoryClientHost } from '../../testing/story-support/story-host'
import type { CharacterTab } from './character-tabs'
import { CharacterDetailScreen } from './CharacterDetailScreen'

const meta = {
  title: 'Screens/캐릭터 상세',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

function hostOf(role: 'dealer' | 'buffer'): ClientHost {
  const detail = storyCharacterDetail(role)
  const catalogs: Readonly<Record<string, SkillWindowCatalog>> = {
    [storySkillWindowCatalog.job.jobName]: storySkillWindowCatalog,
    [storyBuffSkillWindowCatalog.job.jobName]: storyBuffSkillWindowCatalog
  }

  return createStoryClientHost({
    getCharacterDetail: async () => detail,
    getCharacterTimeline: async () => storyTimeline,
    getCharacterHistory: async () => storyHistory,
    getCharacterHistorySnapshot: async () => detail,
    getSkillWindowCatalog: async (jobName) => catalogs[jobName] ?? null,
    getOathCatalog: async () => storyOathCatalog
  })
}

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
    <div className="mx-auto mt-6 w-300 max-w-full">
      <CharacterDetailScreen
        serverId={serverId}
        characterId={characterId}
        tab={tab}
        onTabChange={setTab}
      />
    </div>
  )
}

function tabStory(tab: CharacterTab, role: 'dealer' | 'buffer' = 'dealer'): Story {
  return {
    render: () => (
      <StoryFrame host={hostOf(role)}>
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

export const 타임라인: Story = tabStory('timeline')

export const 이력: Story = tabStory('history')

export const 받는중: Story = {
  render: () => (
    <StoryFrame>
      <Screen initialTab="equipment" />
    </StoryFrame>
  )
}
