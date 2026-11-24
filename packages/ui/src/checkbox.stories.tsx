import type { Meta, StoryObj } from '@storybook/react-vite'
import { Checkbox } from './checkbox'
import { CheckIcon } from './icons'

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  args: { 'aria-label': '첫 번째 진의', disabled: false },
  argTypes: { disabled: { control: 'boolean' } }
} satisfies Meta<typeof Checkbox>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Checkbox aria-label="꺼짐" />
      <Checkbox aria-label="켜짐" defaultChecked />
      <Checkbox aria-label="꺼진 비활성" disabled />
      <Checkbox aria-label="켜진 비활성" defaultChecked disabled />
    </div>
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
      <span className="checkbox" role="checkbox" aria-checked="false" aria-label="꺼짐" />
      <span
        className="checkbox"
        role="checkbox"
        aria-checked="true"
        aria-label="켜짐"
        data-checked=""
      >
        <span className="checkbox-indicator" data-checked="">
          <CheckIcon />
        </span>
      </span>
      <span
        className="checkbox"
        role="checkbox"
        aria-checked="false"
        aria-disabled="true"
        aria-label="꺼진 비활성"
        data-disabled=""
      />
      <span
        className="checkbox"
        role="checkbox"
        aria-checked="true"
        aria-disabled="true"
        aria-label="켜진 비활성"
        data-checked=""
        data-disabled=""
      >
        <span className="checkbox-indicator" data-checked="" data-disabled="">
          <CheckIcon />
        </span>
      </span>
    </div>
  )
}
