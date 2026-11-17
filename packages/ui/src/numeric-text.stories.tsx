import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from './button'
import { NumericText } from './numeric-text'

const meta = {
  title: 'Components/NumericText',
  component: NumericText,
  args: { value: 1234567, countUp: true },
  argTypes: {
    value: { control: 'number' },
    countUp: { control: 'boolean' },
    format: { control: false }
  }
} satisfies Meta<typeof NumericText>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

function CountUpDemo() {
  const [value, setValue] = useState(52_340)
  const handleClick = () => setValue((current) => current + 18_215)

  return (
    <div className="flex items-center gap-4 text-2xl text-fg">
      <NumericText value={value} />
      <Button size="sm" onClick={handleClick}>
        올리기
      </Button>
    </div>
  )
}

export const CountUp: Story = {
  render: () => <CountUpDemo />
}

export const Formatted: Story = {
  args: { value: 0.4271, countUp: false, format: (value) => `${(value * 100).toFixed(1)}%` }
}
