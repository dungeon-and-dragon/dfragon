import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './button'
import { Popover } from './popover'

type ConfirmPopoverProps = {
  side?: 'top' | 'right' | 'bottom' | 'left'
  defaultOpen?: boolean
}

function ConfirmPopover({ side, defaultOpen }: ConfirmPopoverProps) {
  return (
    <Popover.Root defaultOpen={defaultOpen}>
      <Popover.Trigger render={<Button size="sm" />}>고정 풀기</Popover.Trigger>
      <Popover.Popup side={side} role="alertdialog">
        <div className="grid w-56 gap-3 p-3">
          <Popover.Title>고정을 취소하시겠습니까?</Popover.Title>
          <div className="flex justify-end gap-2">
            <Popover.Close render={<Button variant="secondary" size="sm" />}>유지</Popover.Close>
            <Popover.Close render={<Button variant="primary" size="sm" />}>고정 취소</Popover.Close>
          </div>
        </div>
      </Popover.Popup>
    </Popover.Root>
  )
}

const meta = {
  title: 'Components/Popover',
  component: ConfirmPopover,
  args: { side: 'bottom' },
  argTypes: { side: { control: 'inline-radio', options: ['top', 'right', 'bottom', 'left'] } },
  decorators: [
    (Story) => (
      <div className="flex min-h-48 justify-center p-8">
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof ConfirmPopover>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Open: Story = {
  args: { defaultOpen: true }
}

export const Focus: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>('button')?.focus()
  }
}

export const Html: Story = {
  render: () => (
    <div className="popover" role="alertdialog" aria-labelledby="html-popover-title">
      <div className="grid w-56 gap-3 p-3">
        <h2 id="html-popover-title" className="popover-title">
          고정을 취소하시겠습니까?
        </h2>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm">
            유지
          </button>
          <button type="button" className="btn btn-primary btn-sm">
            고정 취소
          </button>
        </div>
      </div>
    </div>
  )
}
