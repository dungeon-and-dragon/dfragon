import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { STORY_ADVENTURE_NAME } from './api/adventure.fixture'
import { adventureHandlers } from './api/adventure.handlers'
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
