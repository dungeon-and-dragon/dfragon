import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button, type ButtonSize, type ButtonVariant } from './button'

const VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger']
const SIZES: readonly ButtonSize[] = ['sm', 'md', 'lg']

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: '버튼', variant: 'secondary', size: 'md', loading: false, disabled: false },
  argTypes: {
    variant: { control: 'inline-radio', options: VARIANTS },
    size: { control: 'inline-radio', options: SIZES },
    children: { control: 'text' },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' }
  }
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {VARIANTS.map((variant) => (
        <Button key={variant} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  )
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {SIZES.map((size) => (
        <Button key={size} variant="primary" size={size}>
          {size}
        </Button>
      ))}
    </div>
  )
}

export const States: Story = {
  render: () => (
    <div className="grid gap-3">
      {VARIANTS.map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-3">
          <Button variant={variant}>기본</Button>
          <Button variant={variant} disabled>
            비활성
          </Button>
          <Button variant={variant} loading>
            진행 중
          </Button>
        </div>
      ))}
    </div>
  )
}

export const Focus: Story = {
  args: { variant: 'primary' },
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>('button')?.focus()
  }
}

export const Html: Story = {
  render: () => (
    <div className="grid gap-3">
      {VARIANTS.map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-3">
          <button type="button" className={`btn btn-${variant} btn-md`}>
            기본
          </button>
          <button type="button" className={`btn btn-${variant} btn-md`} disabled>
            비활성
          </button>
          <button type="button" className={`btn btn-${variant} btn-md`} data-loading="">
            진행 중
          </button>
        </div>
      ))}
    </div>
  )
}
