import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { ClientHost } from '#host/client-host'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import {
  STORY_ADVENTURE_NAME,
  storyAdventureActivity,
  storyAdventureSeasonDays,
  storyAdventureWeekly
} from '#testing/story-support/story-adventure'
import { createStoryClientHost } from '#testing/story-support/story-host'
import { AdventureEntryScreen, WeeklyScreen } from './WeeklyScreen'

const meta = {
  title: 'Screens/모험단',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const adventureHost = createStoryClientHost({
  getAdventureActivity: async () => storyAdventureActivity,
  getAdventureActivitySeasonDays: async () => storyAdventureSeasonDays,
  getAdventureWeekly: async () => storyAdventureWeekly
})

const failedHost = createStoryClientHost({
  getAdventureActivity: async () => {
    throw new Error('모험단 활동을 받지 못했습니다.')
  },
  getAdventureWeekly: async () => {
    throw new Error('주간 던파를 받지 못했습니다.')
  }
})

function ignoreOpen(): void {}

function Screen({ host }: { host?: ClientHost }): React.JSX.Element {
  const [season, setSeason] = useState<number | undefined>()

  return (
    <StoryFrame host={host}>
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
  render: () => <Screen host={adventureHost} />
}

export const 받는중: Story = {
  render: () => <Screen />
}

export const 받지못함: Story = {
  render: () => <Screen host={failedHost} />
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
