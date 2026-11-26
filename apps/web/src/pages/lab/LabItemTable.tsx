import { ItemIcon, itemRarityOfGrade, rarityTextClasses } from '#entities/character'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import type { LabItemCategory } from '@dfragon/lib/lab-items'
import type { LabItem } from './api/useLabItems'
import type { LabCategoryRows } from './lab-tables'

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

function priceOf(unitPrice: number | null): string {
  if (unitPrice === null) {
    return MISSING_VALUE
  }

  return integer.format(unitPrice)
}

export function LabItemTable({
  categoryLabel,
  itemLabel,
  rows
}: {
  categoryLabel: string
  itemLabel: string
  rows: readonly LabCategoryRows[]
}): React.JSX.Element {
  return (
    <div className="table-scroll">
      <table className="table table-fixed table-wide">
        <colgroup>
          <col className="w-[120px]" />
          <col className="w-[120px]" />
          <col />
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
                    <LabItemName item={item} />
                  </td>
                  <td className="table-num font-semibold">{priceOf(item.unitPrice)}</td>
                </tr>
              ))
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function LabItemName({ item }: { item: LabItem }): React.JSX.Element {
  const rarity = itemRarityOfGrade(item.itemRarity)

  return (
    <div className="flex min-w-0 items-center gap-3">
      <ItemIcon itemId={item.itemId} rarity={rarity} />
      <span className={`min-w-0 truncate font-semibold ${rarityTextClasses[rarity ?? 'unknown']}`}>
        {item.itemName}
      </span>
    </div>
  )
}
