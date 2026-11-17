import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './button'
import { Kbd } from './kbd'

const meta = {
  title: 'Components/Kbd',
  component: Kbd,
  args: { surface: 'default', children: 'R' },
  argTypes: {
    surface: { control: 'inline-radio', options: ['default', 'signal'] },
    children: { control: 'text' }
  }
} satisfies Meta<typeof Kbd>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Surfaces: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <span className="inline-flex gap-1">
        <Kbd>Alt</Kbd>
        <Kbd>R</Kbd>
      </span>
      <Button variant="primary">
        인식 <Kbd surface="signal">R</Kbd>
      </Button>
    </div>
  )
}
