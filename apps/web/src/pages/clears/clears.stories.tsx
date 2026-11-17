import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { StoryFrame } from '../../testing/story-support/StoryFrame'
import {
  storyClearContentStats,
  storyClearOverview,
  storyClearStats
} from '../../testing/story-support/story-clears'
import { createStoryClientHost } from '../../testing/story-support/story-host'
import { ClearDetailScreen } from './ClearDetailScreen'
import { ClearOverviewScreen } from './ClearOverviewScreen'

const meta = {
  title: 'Screens/클리어',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const LATEST_WEEK = '2026-11-12'

const host = createStoryClientHost({
  getClearStats: async () => storyClearStats,
  getClearOverview: async (weekStart) => storyClearOverview(weekStart),
  getClearContentStats: async (contentId, weekStart) =>
    storyClearContentStats(contentId, weekStart ?? LATEST_WEEK)
})

function Screen({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="mx-auto mt-6 w-300 max-w-full">{children}</div>
}

function Overview(): React.JSX.Element {
  const [week, setWeek] = useState<string>()

  function openContent(): void {}

  return <ClearOverviewScreen week={week} onWeekSelect={setWeek} onContentOpen={openContent} />
}

function Detail(): React.JSX.Element {
  const [contentKey, setContentKey] = useState('michaela')
  const [stage, setStage] = useState<string>()
  const [week, setWeek] = useState<string>()

  function openContent(next: string): void {
    setContentKey(next)
    setStage(undefined)
  }

  return (
    <ClearDetailScreen
      contentKey={contentKey}
      stage={stage}
      week={week}
      onStageSelect={setStage}
      onWeekSelect={setWeek}
      onContentOpen={openContent}
    />
  )
}

export const 개요: Story = {
  render: () => (
    <StoryFrame host={host}>
      <Screen>
        <Overview />
      </Screen>
    </StoryFrame>
  )
}

export const 컨텐츠상세: Story = {
  render: () => (
    <StoryFrame host={host}>
      <Screen>
        <Detail />
      </Screen>
    </StoryFrame>
  )
}

export const 받는중: Story = {
  render: () => (
    <StoryFrame>
      <Screen>
        <Overview />
      </Screen>
    </StoryFrame>
  )
}
