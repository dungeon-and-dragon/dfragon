import type { Meta, StoryObj } from '@storybook/react-vite'
import { Switch } from './switch'

const meta = {
  title: 'Components/Switch',
  component: Switch,
  args: { 'aria-label': '알림', disabled: false },
  argTypes: { disabled: { control: 'boolean' } }
} satisfies Meta<typeof Switch>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Switch aria-label="꺼짐" />
      <Switch aria-label="켜짐" defaultChecked />
      <Switch aria-label="꺼진 비활성" disabled />
      <Switch aria-label="켜진 비활성" defaultChecked disabled />
    </div>
  )
}

export const Focus: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>('[role="switch"]')?.focus()
  }
}

export const Html: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" className="switch" role="switch" aria-checked="false" aria-label="꺼짐">
        <span className="switch-thumb" />
      </button>
      <button
        type="button"
        className="switch"
        role="switch"
        aria-checked="true"
        aria-label="켜짐"
        data-checked=""
      >
        <span className="switch-thumb" data-checked="" />
      </button>
      <button
        type="button"
        className="switch"
        role="switch"
        aria-checked="false"
        aria-label="꺼진 비활성"
        data-disabled=""
        disabled
      >
        <span className="switch-thumb" data-disabled="" />
      </button>
      <button
        type="button"
        className="switch"
        role="switch"
        aria-checked="true"
        aria-label="켜진 비활성"
        data-checked=""
        data-disabled=""
        disabled
      >
        <span className="switch-thumb" data-checked="" data-disabled="" />
      </button>
    </div>
  )
}
