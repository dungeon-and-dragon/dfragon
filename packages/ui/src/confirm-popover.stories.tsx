import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './button'
import { ConfirmPopover } from './confirm-popover'
import { Popover } from './popover'

const meta = {
  title: 'Components/ConfirmPopover',
  component: ConfirmPopover,
  args: {
    title: 'batch key 삭제',
    confirmLabel: '삭제',
    children: <Popover.Trigger render={<Button size="sm" />}>삭제</Popover.Trigger>,
    onConfirm: async () => {}
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-[224px] justify-center p-8">
        <Story />
      </div>
    )
  ],
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('button')?.click()
  }
} satisfies Meta<typeof ConfirmPopover>

export default meta

type Story = StoryObj<typeof meta>

async function findConfirmButton(): Promise<HTMLButtonElement | null> {
  for (let frame = 0; frame < 60; frame += 1) {
    const button = document.querySelector<HTMLButtonElement>('[role="alertdialog"] .btn-primary')

    if (button !== null) {
      return button
    }

    await new Promise((resolve) => requestAnimationFrame(resolve))
  }

  return null
}

export const Open: Story = {}

export const Failed: Story = {
  args: { onConfirm: async () => Promise.reject(new Error('요청 실패')) },
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('button')?.click()
    const confirm = await findConfirmButton()
    confirm?.click()
  }
}
