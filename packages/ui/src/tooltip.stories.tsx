import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './button'
import { Tooltip } from './tooltip'

const SIDES = ['top', 'right', 'bottom', 'left'] as const

type DescribedButtonProps = {
  side?: (typeof SIDES)[number]
  defaultOpen?: boolean
}

function DescribedButton({ side, defaultOpen }: DescribedButtonProps) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root defaultOpen={defaultOpen}>
        <Tooltip.Trigger render={<Button size="sm" />}>설명 보기</Tooltip.Trigger>
        <Tooltip.Popup side={side}>장비점수는 장비와 버프로 계산합니다.</Tooltip.Popup>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

const meta = {
  title: 'Components/Tooltip',
  component: DescribedButton,
  args: { side: 'top' },
  argTypes: { side: { control: 'inline-radio', options: SIDES } },
  decorators: [
    (Story) => (
      <div className="flex justify-center p-16">
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof DescribedButton>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Open: Story = {
  args: { defaultOpen: true }
}
