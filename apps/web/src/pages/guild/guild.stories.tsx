import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ClientHost } from '../../host/client-host'
import { StoryFrame } from '../../testing/story-support/StoryFrame'
import { storyGuild } from '../../testing/story-support/story-adventure'
import { createStoryClientHost } from '../../testing/story-support/story-host'
import { GuildScreen } from './GuildScreen'

const meta = {
  title: 'Screens/길드',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

function hostOf(memberCount: number): ClientHost {
  const guild = storyGuild(memberCount)

  return createStoryClientHost({ getGuild: async () => guild })
}

const failedHost = createStoryClientHost({
  getGuild: async () => {
    throw new Error('길드를 받지 못했습니다.')
  }
})

function Screen({ host }: { host?: ClientHost }): React.JSX.Element {
  return (
    <StoryFrame host={host}>
      <div className="page mt-6">
        <GuildScreen guildId="guild-1" />
      </div>
    </StoryFrame>
  )
}

export const 길드: Story = {
  render: () => <Screen host={hostOf(48)} />
}

export const 길드원없음: Story = {
  render: () => <Screen host={hostOf(0)} />
}

export const 받는중: Story = {
  render: () => <Screen />
}

export const 받지못함: Story = {
  render: () => <Screen host={failedHost} />
}
