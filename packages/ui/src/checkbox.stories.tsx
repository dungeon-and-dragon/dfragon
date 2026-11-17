import type { Meta, StoryObj } from '@storybook/react-vite'
import { Checkbox } from './checkbox'
import { CheckIcon, DashIcon } from './icons'

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

export const Focus: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>('[role="checkbox"]')?.focus()
  }
}

export const Html: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <span
        className="checkbox"
        role="checkbox"
        aria-checked="false"
        aria-label="꺼짐"
        tabIndex={0}
      />
      <span
        className="checkbox"
        role="checkbox"
        aria-checked="true"
        aria-label="켜짐"
        tabIndex={0}
        data-checked=""
      >
        <span className="checkbox-indicator">
          <CheckIcon />
        </span>
      </span>
      <span
        className="checkbox"
        role="checkbox"
        aria-checked="mixed"
        aria-label="일부"
        tabIndex={0}
        data-indeterminate=""
      >
        <span className="checkbox-indicator">
          <DashIcon />
        </span>
      </span>
      <span
        className="checkbox"
        role="checkbox"
        aria-checked="true"
        aria-disabled="true"
        aria-label="켜진 비활성"
        data-checked=""
        data-disabled=""
      >
        <span className="checkbox-indicator">
          <CheckIcon />
        </span>
      </span>
    </div>
  )
}
