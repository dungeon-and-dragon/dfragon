import type { Meta, StoryObj } from '@storybook/react-vite'
import { Select } from './select'
import type { ControlSurface } from './surface'

const SIZES = ['2xs', 'xs', 'sm', 'md'] as const
const SERVERS = [
  { value: 'cain', label: '카인' },
  { value: 'diregie', label: '디레지에' },
  { value: 'siroco', label: '시로코' },
  { value: 'prey', label: '프레이' },
  { value: 'casillas', label: '카시야스' },
  { value: 'hilder', label: '힐더' },
  { value: 'anton', label: '안톤' },
  { value: 'bakal', label: '바칼' }
]

type ServerSelectProps = {
  size?: (typeof SIZES)[number]
  surface?: ControlSurface
  columns?: number
  defaultOpen?: boolean
  disabled?: boolean
}

function ServerSelect({ size, surface, columns, defaultOpen, disabled }: ServerSelectProps) {
  return (
    <Select.Root
      defaultValue="siroco"
      items={SERVERS}
      defaultOpen={defaultOpen}
      disabled={disabled}
    >
      <Select.Trigger size={size} surface={surface} aria-label="서버">
        <Select.Value />
      </Select.Trigger>
      <Select.Popup aria-label="서버" surface={surface} columns={columns}>
        {SERVERS.map((server) => (
          <Select.Item key={server.value} value={server.value}>
            <Select.ItemText>{server.label}</Select.ItemText>
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  )
}

const meta = {
  title: 'Components/Select',
  component: ServerSelect,
  args: { size: 'sm', surface: 'default', disabled: false },
  argTypes: {
    size: { control: 'inline-radio', options: SIZES },
    surface: { control: 'inline-radio', options: ['default', 'card'] },
    columns: { control: { type: 'number', min: 1, max: 4 } },
    disabled: { control: 'boolean' }
  }
} satisfies Meta<typeof ServerSelect>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {SIZES.map((size) => (
        <ServerSelect key={size} size={size} />
      ))}
    </div>
  )
}

export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <ServerSelect />
      <ServerSelect disabled />
      <div className="bg-surface p-3">
        <ServerSelect surface="card" />
      </div>
    </div>
  )
}

export const Open: Story = {
  args: { defaultOpen: true }
}

export const OpenGrid: Story = {
  args: { defaultOpen: true, columns: 4 }
}

export const OpenCard: Story = {
  args: { defaultOpen: true, surface: 'card', columns: 4 },
  decorators: [
    (Story) => (
      <div className="bg-surface p-3">
        <Story />
      </div>
    )
  ]
}

export const Groups: Story = {
  render: () => (
    <Select.Root defaultValue="siroco" items={SERVERS} defaultOpen>
      <Select.Trigger aria-label="서버">
        <Select.Value />
      </Select.Trigger>
      <Select.Popup aria-label="서버">
        <Select.Group>
          <Select.GroupLabel>앞 서버</Select.GroupLabel>
          {SERVERS.slice(0, 4).map((server) => (
            <Select.Item key={server.value} value={server.value}>
              <Select.ItemText>{server.label}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Group>
        <Select.Separator />
        <Select.Group>
          <Select.GroupLabel>뒤 서버</Select.GroupLabel>
          {SERVERS.slice(4).map((server) => (
            <Select.Item
              key={server.value}
              value={server.value}
              disabled={server.value === 'bakal'}
            >
              <Select.ItemText>{server.label}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Group>
      </Select.Popup>
    </Select.Root>
  )
}
