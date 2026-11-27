import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './button'
import { type ItemDetail, ItemDetailCard, type ItemDetailCardOptions } from './item-detail-card'
import { Tooltip } from './tooltip'

// 합성 아이템이다.
const equipment: ItemDetail = {
  name: '합성 대검',
  rarity: '에픽',
  availableLevel: 115,
  typeDetail: '대검',
  fame: 8500,
  status: [
    { name: '모험가 명성', value: '8500' },
    { name: '물리 공격력', value: '1683' },
    { name: '힘', value: '138' }
  ],
  explain: '[합성 옵션]\n공격 시 합성 효과가 발동합니다.',
  flavorText: '합성 문구'
}

const card: ItemDetail = {
  name: '합성 카드',
  rarity: '레전더리',
  availableLevel: null,
  typeDetail: '카드',
  fame: null,
  status: [],
  explain: '합성 카드 설명',
  flavorText: null
}

const cardOptions: ItemDetailCardOptions = {
  slots: ['무기', '보조장비'],
  rows: [
    { name: '모든 속성 강화', values: ['13', '14', '15'], emphasized: true },
    { name: '공격력', values: ['20', '25', '30'], emphasized: false },
    { name: '모험가 명성', values: ['196', '196', '210'], emphasized: false }
  ]
}

const icon = <span aria-hidden="true" className="block size-[24px] rounded-badge bg-inset" />

type ItemDetailCardStoryProps = {
  item: ItemDetail
  card: ItemDetailCardOptions | null
  buffs?: readonly string[]
}

function ItemDetailCardStory({ item, card, buffs }: ItemDetailCardStoryProps) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root defaultOpen>
        <Tooltip.Trigger render={<Button size="sm" />}>{item.name}</Tooltip.Trigger>
        <Tooltip.Popup side="right" align="start" sideOffset={8}>
          <div className="tooltip-item">
            <ItemDetailCard item={item} icon={icon} card={card} buffs={buffs} />
          </div>
        </Tooltip.Popup>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

const meta = {
  title: 'Components/ItemDetailCard',
  component: ItemDetailCardStory,
  args: { item: equipment, card: null },
  decorators: [
    (Story) => (
      <div className="min-h-[360px] p-4">
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof ItemDetailCardStory>

export default meta

type Story = StoryObj<typeof meta>

export const Equipment: Story = {}

export const EnchantCard: Story = {
  args: { item: card, card: cardOptions }
}

export const Mythic: Story = {
  args: { item: { ...equipment, name: '합성 신화 무기', rarity: '신화' } }
}

export const BuffLines: Story = {
  args: { buffs: ['1~95레벨 스킬 / Lv +1', '[버프 강화] 50레벨 액티브 스킬 / Lv +2'] }
}
