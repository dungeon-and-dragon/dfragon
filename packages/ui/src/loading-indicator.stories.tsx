import type { Meta, StoryObj } from '@storybook/react-vite'
import { LoadingIndicator } from './loading-indicator'

const meta = {
  title: 'Components/LoadingIndicator',
  component: LoadingIndicator,
  args: { children: '불러오는 중' },
  argTypes: { children: { control: 'text' } }
} satisfies Meta<typeof LoadingIndicator>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const InheritedSize: Story = {
  render: (args) => (
    <div className="flex items-center gap-6 text-fg">
      <span className="text-sm">
        <LoadingIndicator {...args} />
      </span>
      <span className="text-2xl">
        <LoadingIndicator {...args} />
      </span>
      <span className="text-5xl text-fg-muted">
        <LoadingIndicator {...args} />
      </span>
    </div>
  )
}
