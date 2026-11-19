import type { Meta, StoryObj } from '@storybook/react-vite'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { guildHandlers } from './api/guild.handlers'
import { GuildScreen } from './GuildScreen'

const meta = {
  title: 'Screens/길드',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

function Screen(): React.JSX.Element {
  return (
    <StoryFrame>
      <StoryScreen>
        <GuildScreen guildId="guild-1" />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 길드: Story = {
  parameters: { msw: [guildHandlers.members(48)] },
  render: () => <Screen />
}

export const 길드원없음: Story = {
  parameters: { msw: [guildHandlers.members(0)] },
  render: () => <Screen />
}

export const 받는중: Story = {
  parameters: { msw: [guildHandlers.loading] },
  render: () => <Screen />
}

export const 받지못함: Story = {
  parameters: { msw: [guildHandlers.failure] },
  render: () => <Screen />
}
