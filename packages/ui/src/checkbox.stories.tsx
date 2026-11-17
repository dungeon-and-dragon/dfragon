import type { Meta, StoryObj } from '@storybook/react-vite'
import { Checkbox } from './checkbox'

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  args: { 'aria-label': '선택', disabled: false },
  argTypes: {
    disabled: { control: 'boolean' },
    indeterminate: { control: 'boolean' }
  }
} satisfies Meta<typeof Checkbox>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Checkbox aria-label="꺼짐" />
      <Checkbox aria-label="켜짐" defaultChecked />
      <Checkbox aria-label="일부" indeterminate />
      <Checkbox aria-label="꺼진 비활성" disabled />
      <Checkbox aria-label="켜진 비활성" defaultChecked disabled />
    </div>
  )
}

export const WithLabel: Story = {
  render: () => (
    <label className="inline-flex items-center gap-2 text-sm text-fg">
      <Checkbox defaultChecked />
      크롭 저장
    </label>
  )
}
