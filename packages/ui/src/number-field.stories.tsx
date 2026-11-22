import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { NumberField, type NumberFieldProps } from './number-field'

const meta = {
  title: 'Components/NumberField',
  component: NumberField,
  args: {
    'aria-label': '수치',
    value: 12,
    onValueChange: () => {},
    min: 0,
    max: 20,
    disabled: false,
    format: { signDisplay: 'always' }
  },
  argTypes: {
    min: { control: 'number' },
    max: { control: 'number' },
    disabled: { control: 'boolean' }
  }
} satisfies Meta<typeof NumberField>

export default meta

type Story = StoryObj<typeof meta>

function ControlledField(props: NumberFieldProps) {
  const [value, setValue] = useState(props.value)

  return <NumberField {...props} value={value} onValueChange={setValue} />
}

export const Playground: Story = {
  render: (args) => <ControlledField {...args} />
}

export const States: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-4">
      <ControlledField {...args} aria-label="최소" value={0} />
      <ControlledField {...args} aria-label="중간" value={12} />
      <ControlledField {...args} aria-label="최대" value={20} />
      <ControlledField {...args} aria-label="비활성" value={8} disabled />
    </div>
  )
}
