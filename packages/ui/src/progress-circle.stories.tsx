import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProgressCircle } from './progress-circle'

const TONES = ['neutral', 'brand', 'staticWhite', 'inherit'] as const

const meta = {
  title: 'Components/ProgressCircle',
  component: ProgressCircle,
  args: { size: '40', tone: 'neutral', 'aria-label': '진행' },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100 } },
    size: { control: 'inline-radio', options: ['24', '40', 'inherit'] },
    tone: { control: 'inline-radio', options: TONES }
  }
} satisfies Meta<typeof ProgressCircle>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Values: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <ProgressCircle aria-label="불러오는 중" />
      {[0, 30, 60, 100].map((value) => (
        <ProgressCircle key={value} value={value} aria-label={`${value}% 진행`} />
      ))}
    </div>
  )
}

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      {TONES.map((tone) => (
        <div key={tone} className="bg-surface p-2 text-fg-subtle">
          <ProgressCircle tone={tone} value={60} aria-label={tone} />
        </div>
      ))}
    </div>
  )
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4 text-fg">
      <ProgressCircle size="24" value={60} aria-label="24" />
      <ProgressCircle size="40" value={60} aria-label="40" />
      <span className="text-display">
        <ProgressCircle size="inherit" value={60} aria-label="글자 크기" />
      </span>
    </div>
  )
}
