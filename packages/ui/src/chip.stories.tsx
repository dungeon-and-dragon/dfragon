import type { Meta, StoryObj } from '@storybook/react-vite'
import { Chip } from './chip'

const meta = {
  title: 'Components/Chip',
  component: Chip,
  args: { children: '원본', disabled: false },
  argTypes: {
    children: { control: 'text' },
    disabled: { control: 'boolean' }
  }
} satisfies Meta<typeof Chip>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Chip>꺼짐</Chip>
      <Chip defaultPressed>켜짐</Chip>
      <Chip disabled>꺼진 비활성</Chip>
      <Chip defaultPressed disabled>
        켜진 비활성
      </Chip>
    </div>
  )
}
