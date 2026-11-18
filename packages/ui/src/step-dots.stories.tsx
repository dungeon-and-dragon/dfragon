import type { Meta, StoryObj } from '@storybook/react-vite'
import { StepDots } from './step-dots'

const meta = {
  title: 'Components/StepDots',
  component: StepDots
} satisfies Meta<typeof StepDots>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {
  render: () => (
    <div className="text-fg">
      <StepDots />
    </div>
  )
}
