import type { Meta, StoryObj } from '@storybook/react-vite'
import { StepDots } from './step-dots'

const meta = {
  title: 'Components/StepDots',
  component: StepDots,
  args: { size: 4 },
  argTypes: { size: { control: 'inline-radio', options: [4, 5] } }
} satisfies Meta<typeof StepDots>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-6 text-fg">
      <StepDots size={4} />
      <StepDots size={5} />
    </div>
  )
}
