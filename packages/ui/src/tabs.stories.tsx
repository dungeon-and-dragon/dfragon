import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ControlSurface } from './surface'
import { Tabs } from './tabs'

const TABS = [
  { value: 'equipment', label: '장비' },
  { value: 'buff', label: '버프' },
  { value: 'avatar', label: '아바타' },
  { value: 'creature', label: '크리처', disabled: true }
]

function CharacterTabs({ surface }: { surface?: ControlSurface }) {
  return (
    <Tabs.Root defaultValue="equipment">
      <Tabs.List aria-label="캐릭터 정보" surface={surface}>
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
  component: CharacterTabs,
  args: { surface: 'default' },
  argTypes: { surface: { control: 'inline-radio', options: ['default', 'card'] } }
} satisfies Meta<typeof CharacterTabs>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Card: Story = {
  args: { surface: 'card' },
  decorators: [
    (Story) => (
      <div className="max-w-md bg-surface">
        <Story />
      </div>
    )
  ]
}
