import type { Meta, StoryObj } from '@storybook/react-vite'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { STORY_ADVENTURE } from './api/epic-souls.fixture'
import { epicSoulsHandlers } from './api/epic-souls.handlers'
import { LabEpicSoulsScreen } from './LabEpicSoulsScreen'

const meta = {
  title: 'Screens/실험실 숨은 에소찾기',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

function Screen({ adventureName }: { adventureName: string | null }): React.JSX.Element {
  return (
    <StoryFrame>
      <StoryScreen>
        <LabEpicSoulsScreen initialAdventureName={adventureName} />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 에픽소울: Story = {
  parameters: { msw: [epicSoulsHandlers.characters, epicSoulsHandlers.recoveries] },
  render: () => <Screen adventureName={STORY_ADVENTURE} />
}

export const 검색전: Story = {
  render: () => <Screen adventureName={null} />
}

export const 목록받는중: Story = {
  parameters: { msw: [epicSoulsHandlers.charactersLoading] },
  render: () => <Screen adventureName={STORY_ADVENTURE} />
}

export const 줄받는중: Story = {
  parameters: { msw: [epicSoulsHandlers.characters, epicSoulsHandlers.recoveriesLoading] },
  render: () => <Screen adventureName={STORY_ADVENTURE} />
}

export const 모험단없음: Story = {
  parameters: { msw: [epicSoulsHandlers.noAdventure] },
  render: () => <Screen adventureName="없는모험단" />
}

export const 받지못함: Story = {
  parameters: { msw: [epicSoulsHandlers.charactersFailure] },
  render: () => <Screen adventureName={STORY_ADVENTURE} />
}
