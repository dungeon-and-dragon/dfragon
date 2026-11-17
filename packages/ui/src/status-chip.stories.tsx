import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatusChip, type StatusChipTone } from './status-chip'

const TONES: readonly StatusChipTone[] = ['neutral', 'success', 'danger', 'warning', 'signal']

const meta = {
  title: 'Components/StatusChip',
  component: StatusChip,
  args: { tone: 'success', size: 'sm', busy: false, children: '연결됨' },
  argTypes: {
    tone: { control: 'inline-radio', options: TONES },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    busy: { control: 'boolean' },
    children: { control: 'text' }
  }
} satisfies Meta<typeof StatusChip>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Tones: Story = {
  render: () => (
    <div className="grid gap-3">
      {(['sm', 'md'] as const).map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-2">
          {TONES.map((tone) => (
            <StatusChip key={tone} tone={tone} size={size}>
              {tone}
            </StatusChip>
          ))}
        </div>
      ))}
    </div>
  )
}

export const Busy: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {TONES.map((tone) => (
        <StatusChip key={tone} tone={tone} busy>
          {tone}
        </StatusChip>
      ))}
    </div>
  )
}
