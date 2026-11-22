import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { STORY_ADVENTURE_NAME } from './api/adventure.fixture'
import { adventureHandlers } from './api/adventure.handlers'
import { AdventureEquipmentScreen } from './AdventureEquipmentScreen'
import { AdventureTimelineScreen } from './AdventureTimelineScreen'
import type { EquipmentSearch } from './equipment-search'
import type { TimelineSearch } from './timeline-search'
import { AdventureEntryScreen, WeeklyScreen } from './WeeklyScreen'

const meta = {
  title: 'Screens/모험단',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

function ignoreOpen(): void {}

function Screen({ initialSeason }: { initialSeason?: number }): React.JSX.Element {
  const [season, setSeason] = useState(initialSeason)

  return (
    <StoryFrame>
      <StoryScreen>
        <WeeklyScreen
          adventureName={STORY_ADVENTURE_NAME}
          season={season}
          onSeasonChange={setSeason}
          onAdventureOpen={ignoreOpen}
        />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 모험단: Story = {
  parameters: { msw: adventureHandlers.adventure },
  render: () => <Screen />
}

export const 시즌10: Story = {
  parameters: { msw: adventureHandlers.adventure },
  render: () => <Screen initialSeason={10} />
}

export const 시즌9: Story = {
  parameters: { msw: adventureHandlers.adventure },
  render: () => <Screen initialSeason={9} />
}

export const 받는중: Story = {
  parameters: { msw: adventureHandlers.loading },
  render: () => <Screen />
}

export const 받지못함: Story = {
  parameters: { msw: adventureHandlers.failure },
  render: () => <Screen />
}

export const 모험단입력: Story = {
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <AdventureEntryScreen onAdventureOpen={ignoreOpen} />
      </StoryScreen>
    </StoryFrame>
  )
}

function EquipmentScreen({ initialSearch = {} }: { initialSearch?: EquipmentSearch }) {
  const [search, setSearch] = useState(initialSearch)

  return (
    <StoryFrame>
      <StoryScreen>
        <AdventureEquipmentScreen
          adventureName={STORY_ADVENTURE_NAME}
          search={search}
          onSearchChange={setSearch}
          onAdventureOpen={ignoreOpen}
        />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 장비: Story = {
  parameters: { msw: adventureHandlers.adventure },
  render: () => <EquipmentScreen />
}

export const 장비_다른서버: Story = {
  parameters: { msw: adventureHandlers.adventure },
  render: () => <EquipmentScreen initialSearch={{ server: 'siroco' }} />
}

export const 장비_받는중: Story = {
  parameters: { msw: adventureHandlers.loading },
  render: () => <EquipmentScreen />
}

export const 장비_받지못함: Story = {
  parameters: { msw: adventureHandlers.failure },
  render: () => <EquipmentScreen />
}

export const 장비_캐릭터없음: Story = {
  parameters: { msw: adventureHandlers.emptyEquipment },
  render: () => <EquipmentScreen />
}

function TimelineScreen({ initialSearch = {} }: { initialSearch?: TimelineSearch }) {
  const [search, setSearch] = useState(initialSearch)

  return (
    <StoryFrame>
      <StoryScreen>
        <AdventureTimelineScreen
          adventureName={STORY_ADVENTURE_NAME}
          search={search}
          onSearchChange={setSearch}
          onAdventureOpen={ignoreOpen}
        />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 타임라인: Story = {
  parameters: { msw: adventureHandlers.adventure },
  render: () => <TimelineScreen />
}

export const 타임라인_획득: Story = {
  parameters: { msw: adventureHandlers.adventure },
  render: () => <TimelineScreen initialSearch={{ kind: 'acquisition' }} />
}

export const 타임라인_받는중: Story = {
  parameters: { msw: adventureHandlers.loading },
  render: () => <TimelineScreen />
}

export const 타임라인_받지못함: Story = {
  parameters: { msw: adventureHandlers.failure },
  render: () => <TimelineScreen />
}
