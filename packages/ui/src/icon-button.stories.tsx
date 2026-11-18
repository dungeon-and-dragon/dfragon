import type { Meta, StoryObj } from '@storybook/react-vite'
import { IconButton } from './icon-button'
import { CloseIcon } from './icons'

const SIZES = ['sm', 'md', 'lg'] as const

const meta = {
  title: 'Components/IconButton',
  component: IconButton,
  args: { 'aria-label': '닫기', icon: <CloseIcon />, size: 'md', disabled: false },
  argTypes: {
    size: { control: 'inline-radio', options: SIZES },
    pressed: { control: 'boolean' },
    icon: { control: false },
    disabled: { control: 'boolean' }
  }
} satisfies Meta<typeof IconButton>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {SIZES.map((size) => (
        <IconButton key={size} {...args} size={size} />
      ))}
    </div>
  )
}

export const States: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <IconButton {...args} />
      <IconButton {...args} pressed={false} />
      <IconButton {...args} pressed />
      <IconButton {...args} disabled />
    </div>
  )
}

export const Focus: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>('button')?.focus()
  }
}

export const Html: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {SIZES.map((size) => (
        <button key={size} type="button" className={`icon-btn icon-btn-${size}`} aria-label="닫기">
          <span aria-hidden="true">
            <CloseIcon />
          </span>
        </button>
      ))}
      <button type="button" className="icon-btn icon-btn-lg" aria-label="켜짐" aria-pressed="true">
        <span aria-hidden="true">
          <CloseIcon />
        </span>
      </button>
      <button type="button" className="icon-btn icon-btn-md" aria-label="비활성" disabled>
        <span aria-hidden="true">
          <CloseIcon />
        </span>
      </button>
    </div>
  )
}
