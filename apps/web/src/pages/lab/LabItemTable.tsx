import {
  ItemIcon,
  itemIconUrl,
  type ItemRarity,
  itemPartClasses,
  itemRarityOfGrade,
  raritySolidOf,
  rarityTextClasses
} from '#entities/character'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import { Tooltip } from '@dfragon/ui'
import { ItemDetailTooltip, ItemTooltip } from '#widgets/item-tooltip'
import type { LabItemCategory } from '@dfragon/lib/lab-items'
import type { LabCurrencyCost, LabItem } from './api/useLabItems'
import type { EnchantRole, LabCategoryRows } from './lab-tables'

const CATEGORY_NAMES: Readonly<Record<LabItemCategory, string>> = {
  WEAPON: '무기',
  JACKET: '상의',
  SHOULDER: '머리어깨',
  PANTS: '하의',
  WAIST: '벨트',
  SHOES: '신발',
  AMULET: '목걸이',
  WRIST: '팔찌',
  RING: '반지',
  SUPPORT: '보조장비',
  MAGIC_STON: '마법석',
  EARRING: '귀걸이',
  TITLE: '칭호',
  CREATURE: '크리쳐',
  AURA: '오라'
}

// 위 행과 합친 칸 아래의 행에서는 이 칸이 행의 첫 칸이 되어 표의 첫 칸 여백(16px)을 받으므로 다른 칸의 여백으로 되돌린다.
const MERGED_ROW_CELL = 'pl-3'
// 표의 마지막 행만 밑줄을 지우므로, 마지막 부위를 합친 칸은 앞 행에 있어 밑줄이 홀로 남는다.
const LAST_ROW_CELL = 'border-b-0'

const integer = new Intl.NumberFormat('ko-KR')

function integerText(value: number | null): string {
  if (value === null) {
    return MISSING_VALUE
  }

  return integer.format(value)
}

export function LabItemTable({
  categoryLabel,
  itemLabel,
  rows,
  role,
  withFame = false
}: {
  categoryLabel: string
  itemLabel: string
  rows: readonly LabCategoryRows[]
  role?: EnchantRole
  withFame?: boolean
}): React.JSX.Element {
  return (
    <div className="table-scroll">
      <table className="table table-fixed table-wide">
        <colgroup>
          <col className="w-[120px]" />
          <col className="w-[120px]" />
          <col />
          {withFame && <col className="w-[100px]" />}
          <col className="w-[160px]" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="text-center">
              {categoryLabel}
            </th>
            <th scope="col" className="text-center">
              등급
            </th>
            <th scope="col">{itemLabel}</th>
            {withFame && (
              <th scope="col" className="table-num">
                명성
              </th>
            )}
            <th scope="col" className="table-num">
              최저가
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.flatMap(({ category, tiers }, categoryIndex) => {
            const categoryRowCount = tiers.reduce((sum, { items }) => sum + items.length, 0)
            const categoryCellBorder = categoryIndex === rows.length - 1 ? LAST_ROW_CELL : ''

            return tiers.flatMap(({ tier, items }, tierIndex) =>
              items.map((item, itemIndex) => (
                <tr key={`${category}:${tier}:${item.itemName}`}>
                  {tierIndex === 0 && itemIndex === 0 && (
                    // 한 tbody 안의 scope="rowgroup"은 뒤 부위의 행까지 덮으므로 합친 행만 덮는 row로 둔다.
                    <th
                      scope="row"
                      rowSpan={categoryRowCount}
                      className={`text-center font-semibold ${categoryCellBorder}`}
                    >
                      {CATEGORY_NAMES[category]}
                    </th>
                  )}
                  {itemIndex === 0 && (
                    <td
                      rowSpan={items.length}
                      className={`${MERGED_ROW_CELL} text-center text-fg-muted`}
                    >
                      {tier}
                    </td>
                  )}
                  <td className={MERGED_ROW_CELL}>
                    <LabItemName item={item} role={role} />
                  </td>
                  {withFame && <td className="table-num">{integerText(item.fame)}</td>}
                  <td className="table-num font-semibold">
                    <LabItemPrice item={item} />
                  </td>
                </tr>
              ))
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function LabItemIcon({
  item,
  rarity
}: {
  item: LabItem
  rarity: ItemRarity | null
}): React.JSX.Element {
  if (item.iconUrl === null) {
    return <ItemIcon itemId={item.itemId} rarity={rarity} />
  }

  return (
    <img
      src={item.iconUrl}
      alt=""
      loading="lazy"
      className={`${itemPartClasses.icon} size-game-icon ${raritySolidOf(rarity)}`}
    />
  )
}

function LabItemName({
  item,
  role
}: {
  item: LabItem
  role: EnchantRole | undefined
}): React.JSX.Element {
  const rarity = itemRarityOfGrade(item.itemRarity)
  const nameClassName = rarityTextClasses[rarity ?? 'unknown']
  const name = (
    <div className="inline-flex max-w-full items-center gap-3 align-middle">
      <LabItemIcon item={item} rarity={rarity} />
      <span className={`min-w-0 truncate font-semibold ${nameClassName}`}>{item.itemName}</span>
    </div>
  )

  if (item.tooltip === null && item.itemId !== null) {
    return (
      <ItemTooltip itemId={item.itemId} role={role}>
        {name}
      </ItemTooltip>
    )
  }

  if (item.tooltip === null) {
    return name
  }

  const detail = {
    name: item.itemName,
    rarity: item.itemRarity,
    itemType: null,
    ...item.tooltip,
    status: [],
    explain: item.description,
    flavorText: null
  }
  const neopleIconUrl = item.itemId !== null ? itemIconUrl(item.itemId) : null
  const iconUrl = item.iconUrl ?? neopleIconUrl

  return (
    <ItemDetailTooltip item={detail} iconUrl={iconUrl} role={role}>
      {name}
    </ItemDetailTooltip>
  )
}

// 재화는 Neople 아이템 정보가 없어 운영 화면에서 넣은 이름과 설명을 아이템 정보 tooltip과 같은 모양의 상자로 보인다.
function CurrencyTooltip({ cost }: { cost: LabCurrencyCost }): React.JSX.Element {
  const icon = <img src={cost.iconUrl} alt="" className="size-[24px]" />

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        delay={0}
        closeDelay={0}
        render={<img src={cost.iconUrl} alt={cost.currencyName} className="size-[24px]" />}
      />
      <Tooltip.Popup side="left" align="start" sideOffset={8}>
        <div className="tooltip-item">
          <div className="flex max-w-[280px] flex-col gap-2 text-fg">
            <div className="flex items-center gap-2">
              {icon}
              <b className="min-w-0 grow text-sm">{cost.currencyName}</b>
            </div>
            {cost.description !== null && (
              <p className="m-0 border-t border-line pt-2 whitespace-pre-line">
                {cost.description}
              </p>
            )}
          </div>
        </div>
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}

function CurrencyCost({ cost }: { cost: LabCurrencyCost }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {integer.format(cost.count)}
      <CurrencyTooltip cost={cost} />
    </span>
  )
}

function LabItemPrice({ item }: { item: LabItem }): React.JSX.Element {
  if (item.cost !== null) {
    return <CurrencyCost cost={item.cost} />
  }

  return <>{integerText(item.unitPrice)}</>
}
