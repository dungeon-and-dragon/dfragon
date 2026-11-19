import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ChevronDownIcon } from './icons'
import { Select } from './select'

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
  columns?: number
  defaultOpen?: boolean
  disabled?: boolean
}

function ServerSelect({ size, columns, defaultOpen, disabled }: ServerSelectProps) {
  return (
    <Select.Root
      defaultValue="siroco"
      items={SERVERS}
      defaultOpen={defaultOpen}
      disabled={disabled}
    >
      <Select.Trigger size={size} aria-label="서버">
        <Select.Value />
      </Select.Trigger>
      <Select.Popup aria-label="서버" columns={columns}>
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
  args: { size: 'sm', disabled: false },
  argTypes: {
    size: { control: 'inline-radio', options: SIZES },
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
    </div>
  )
}

export const Open: Story = {
  args: { defaultOpen: true }
}

export const OpenGrid: Story = {
  args: { defaultOpen: true, columns: 4 }
}

export const OpenRowChip: Story = {
  args: { defaultOpen: true, size: '2xs', columns: 4 }
}

export const Focus: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>('[role="combobox"]')?.focus()
  }
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

export const Html: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <div className="grid gap-2">
        <button type="button" className="select select-sm">
          <span className="select-value">시로코</span>
          <span className="select-icon">
            <ChevronDownIcon />
          </span>
        </button>
        <button type="button" className="select select-2xs">
          <span className="select-value">시로코</span>
          <span className="select-icon">
            <ChevronDownIcon />
          </span>
        </button>
      </div>
      <div className="grid gap-1">
        <button type="button" className="select select-sm" data-popup-open="">
          <span className="select-value">시로코</span>
          <span className="select-icon">
            <ChevronDownIcon />
          </span>
        </button>
        <div className="listbox" role="presentation">
          <div role="listbox" aria-label="서버">
            <div className="listbox-item" role="option" aria-selected="false">
              카인
            </div>
            <div className="listbox-item" role="option" aria-selected="false" data-highlighted="">
              디레지에
            </div>
            <div className="listbox-item" role="option" aria-selected="true" data-selected="">
              <span className="listbox-marker" />
              시로코
            </div>
            <div className="listbox-separator" role="separator" />
            <div className="listbox-item" role="option" aria-disabled="true" data-disabled="">
              바칼
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ITEMS = [
  { value: 'ring', label: '광휘를 머금은 눈동자', slot: '반지' },
  { value: 'support', label: '만병을 잉태한 역병의 심장', slot: '보조장비' },
  { value: 'stone', label: '우아한 기품의 향수', slot: '마법석' }
]

function ItemMark() {
  return (
    <span
      aria-hidden="true"
      className="block size-[24px] shrink-0 rounded-badge border border-line-strong bg-inset"
    />
  )
}

function IconSelect() {
  return (
    <Select.Root defaultValue="ring" items={ITEMS}>
      <Select.Trigger size="sm" aria-label="아이템">
        <ItemMark />
        <Select.Value />
      </Select.Trigger>
      <Select.Popup aria-label="아이템">
        {ITEMS.map((item) => (
          <Select.Item key={item.value} value={item.value}>
            <ItemMark />
            <Select.ItemText>{item.label}</Select.ItemText>
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  )
}

function countText(values: string[]): string {
  if (values.length === 0) {
    return '아이템 전체'
  }

  const chosen = ITEMS.find((item) => item.value === values[0])

  if (values.length > 1 || chosen === undefined) {
    return `${values.length}개`
  }

  return chosen.label
}

function MultipleSelect({ defaultValue }: { defaultValue: string[] }) {
  const [value, setValue] = useState(defaultValue)

  return (
    <Select.Root multiple value={value} onValueChange={setValue} items={ITEMS}>
      <Select.Trigger size="sm" aria-label="아이템 여러 개">
        {value.length > 0 && (
          <span className="flex items-center gap-1">
            {value.map((itemId) => (
              <ItemMark key={itemId} />
            ))}
          </span>
        )}
        <Select.Value>{countText}</Select.Value>
      </Select.Trigger>
      <Select.Popup aria-label="아이템 여러 개">
        {ITEMS.map((item) => (
          <Select.Group key={item.value}>
            <Select.GroupLabel>{item.slot}</Select.GroupLabel>
            <Select.Item value={item.value}>
              <ItemMark />
              <Select.ItemText>{item.label}</Select.ItemText>
            </Select.Item>
          </Select.Group>
        ))}
      </Select.Popup>
    </Select.Root>
  )
}

export const Icons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <IconSelect />
      <MultipleSelect defaultValue={[]} />
      <MultipleSelect defaultValue={['ring']} />
      <MultipleSelect defaultValue={['ring', 'support']} />
    </div>
  )
}
