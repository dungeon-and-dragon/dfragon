import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from './button'
import { Menu } from './menu'

type SearchMenuProps = {
  defaultOpen?: boolean
}

function SearchMenu({ defaultOpen }: SearchMenuProps) {
  const [mode, setMode] = useState('party')

  return (
    <Menu.Root defaultOpen={defaultOpen}>
      <Menu.Trigger render={<Button variant="ghost" />}>
        검색 {mode === 'party' ? '파티' : '공대'}
      </Menu.Trigger>
      <Menu.Popup aria-label="검색 방식">
        <Menu.Group>
          <Menu.GroupLabel>방식</Menu.GroupLabel>
          <Menu.RadioGroup value={mode} onValueChange={setMode}>
            <Menu.RadioItem value="party" closeOnClick>
              파티
            </Menu.RadioItem>
            <Menu.RadioItem value="raid" closeOnClick>
              공대
            </Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Group>
        <Menu.Separator />
        <Menu.Item>최근 검색 지우기</Menu.Item>
        <Menu.Item disabled>내보내기</Menu.Item>
      </Menu.Popup>
    </Menu.Root>
  )
}

const meta = {
  title: 'Components/Menu',
  component: SearchMenu
} satisfies Meta<typeof SearchMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Open: Story = {
  args: { defaultOpen: true }
}
