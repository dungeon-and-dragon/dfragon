import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ChipGroup } from './chip-group'

const PERIODS = [
  { value: 'half', label: '반년' },
  { value: 'quarter', label: '분기' },
  { value: 'month', label: '한 달' }
]

const STAGES = [
  { value: 'hard', label: '하드' },
  { value: 'normal', label: '일반' }
]

const meta = {
  title: 'Components/ChipGroup',
  component: ChipGroup,
  args: {
    items: PERIODS,
    value: 'half',
    size: 'sm',
    'aria-label': '기간',
    onValueChange: () => {}
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md'] }
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value)

    return <ChipGroup {...args} value={value} onValueChange={setValue} />
  }
} satisfies Meta<typeof ChipGroup>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Medium: Story = {
  args: { items: STAGES, value: 'hard', size: 'md', 'aria-label': '단계' }
}

export const Html: Story = {
  render: () => (
    <div className="chip-group" role="group" aria-label="기간">
      <button type="button" className="chip" aria-pressed="true" data-pressed="">
        반년
      </button>
      <button type="button" className="chip" aria-pressed="false">
        분기
      </button>
      <button type="button" className="chip" aria-pressed="false">
        한 달
      </button>
    </div>
  )
}
