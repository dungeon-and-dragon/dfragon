import type { Meta, StoryObj } from '@storybook/react-vite'
import { Chip } from './chip'

const meta = {
  title: 'Components/Chip',
  component: Chip,
  args: { children: '원본', disabled: false },
  argTypes: {
    children: { control: 'text' },
    disabled: { control: 'boolean' }
  }
} satisfies Meta<typeof Chip>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Chip>꺼짐</Chip>
      <Chip defaultPressed>켜짐</Chip>
      <Chip disabled>꺼진 비활성</Chip>
      <Chip defaultPressed disabled>
        켜진 비활성
      </Chip>
    </div>
  )
}

export const List: Story = {
  render: () => (
    <div className="chip-list w-[288px]" role="group" aria-label="마법부여">
      <Chip defaultPressed>현재 마법부여</Chip>
      <span className="chip-list-label">종결</span>
      <Chip>최종 데미지 증가 +2%</Chip>
      <Chip>화속성 강화 +15, 명속성 강화 +15, 수속성 강화 +15, 암속성 강화 +15</Chip>
      <span className="chip-list-label">준종결</span>
      <Chip>스킬 공격력 증가 +1%</Chip>
    </div>
  )
}

export const Focus: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>('button')?.focus()
  }
}

export const Html: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="chip" aria-pressed="false">
        꺼짐
      </button>
      <button type="button" className="chip" aria-pressed="true" data-pressed="">
        켜짐
      </button>
      <button type="button" className="chip" aria-pressed="false" disabled>
        꺼진 비활성
      </button>
      <button type="button" className="chip" aria-pressed="true" data-pressed="" disabled>
        켜진 비활성
      </button>
    </div>
  )
}
