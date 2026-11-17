import type { Meta, StoryObj } from '@storybook/react-vite'
import { Tabs } from './tabs'

const TABS = [
  { value: 'equipment', label: '장비' },
  { value: 'buff', label: '버프' },
  { value: 'avatar', label: '아바타' },
  { value: 'creature', label: '크리처', disabled: true }
]

function CharacterTabs() {
  return (
    <Tabs.Root defaultValue="equipment">
      <Tabs.List aria-label="캐릭터 정보">
        {TABS.map((tab) => (
          <Tabs.Tab key={tab.value} value={tab.value} disabled={tab.disabled}>
            {tab.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {TABS.map((tab) => (
        <Tabs.Panel key={tab.value} value={tab.value} className="py-4 text-sm text-fg-muted">
          {tab.label} 패널
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  )
}

const meta = {
  title: 'Components/Tabs',
  component: CharacterTabs
} satisfies Meta<typeof CharacterTabs>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Focus: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>('[role="tab"]')?.focus()
  }
}

export const Html: Story = {
  render: () => (
    <div className="tabs" role="tablist" aria-label="캐릭터 정보">
      <button type="button" className="tab" role="tab" aria-selected="true">
        장비
      </button>
      <button type="button" className="tab" role="tab" aria-selected="false">
        버프
      </button>
      <button type="button" className="tab" role="tab" aria-selected="false">
        아바타
      </button>
      <button type="button" className="tab" role="tab" aria-selected="false" data-disabled="">
        크리처
      </button>
    </div>
  )
}
