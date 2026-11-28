import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { clearStatsHandlers } from './api/clears.handlers'
import { ClearDetailScreen } from './ClearDetailScreen'
import { ClearOverviewScreen } from './ClearOverviewScreen'

const meta = {
  title: 'Screens/클리어',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

function Overview(): React.JSX.Element {
  function openContent(): void {}

  return <ClearOverviewScreen onContentOpen={openContent} />
}

function Detail({ initialContentKey }: Readonly<{ initialContentKey: string }>): React.JSX.Element {
  const [contentKey, setContentKey] = useState(initialContentKey)
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
  parameters: { msw: clearStatsHandlers.stats },
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <Overview />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 컨텐츠상세: Story = {
  parameters: { msw: clearStatsHandlers.stats },
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <Detail initialContentKey="michaela" />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 레기온상세: Story = {
  parameters: { msw: clearStatsHandlers.stats },
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <Detail initialContentKey="apocalypse" />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 받는중: Story = {
  parameters: { msw: clearStatsHandlers.loading },
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <Overview />
      </StoryScreen>
    </StoryFrame>
  )
}
