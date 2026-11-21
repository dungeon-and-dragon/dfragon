import { type Bar, type BarTone, RowBars } from '#shared/ui/chart/RowBars'
import { ListBox } from '#shared/ui/ListBox'
import { ItemIcon } from '#entities/character'
import { ItemTooltip } from './ItemTooltip'
import { type SetStatsFilter, useItemStats } from '#entities/ranking'
import { uniqueItemBars, type ItemBar, weaponBars } from './item-stats-bars'
import { formatShare } from './set-stats-bars'

const WEAPON = '무기'
const UNIQUE = '유일 장비'
const EMPTY = '아이템 통계가 없습니다.'
const FAILED = '아이템 통계를 받지 못했습니다.'
// 무기 이름은 "제2형 - 수식, 방어의 운검"처럼 길어 반 폭 상자에서 세트 이름 칸보다 넓게 둔다.
const ITEM_NAME_WIDTH = 220
const headcount = new Intl.NumberFormat('ko-KR')

type ItemBox = Readonly<{
  name: string
  bars: readonly Bar[]
  tone: BarTone
  formatValue: (value: number) => string
}>

function formatHeadcount(count: number): string {
  return `${headcount.format(count)}명`
}

function ItemLabel({ itemId, name }: { itemId: string; name: string }): React.JSX.Element {
  return (
    <ItemTooltip itemId={itemId}>
      <span className="inline-flex max-w-full items-center gap-2 align-middle">
        <ItemIcon itemId={itemId} rarity={null} size="sm" />
        <span className="truncate">{name}</span>
      </span>
    </ItemTooltip>
  )
}

function withItemLabel({ itemId, ...bar }: ItemBar): Bar {
  if (itemId === null) {
    return bar
  }

  return { ...bar, label: <ItemLabel itemId={itemId} name={bar.name} /> }
}

function SameContentRow({ content }: { content: React.JSX.Element }): React.JSX.Element {
  return (
    <div className="section section-cols">
      {[WEAPON, UNIQUE].map((name) => (
        <ListBox key={name} name={name}>
          {content}
        </ListBox>
      ))}
    </div>
  )
}

export function ItemStatsBoxes({ filter }: { filter: SetStatsFilter }): React.JSX.Element {
  const result = useItemStats(filter)

  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true">
          <span role="status" className="sr-only">
            아이템 통계를 받는 중입니다.
          </span>
          <div aria-hidden="true">
            <SameContentRow content={<span className="skeleton h-[160px]" />} />
          </div>
        </div>
      )
    case 'error':
      return (
        <SameContentRow
          content={
            <p role="alert" className="state state-error">
              {FAILED}
            </p>
          }
        />
      )
    case 'success': {
      const stats = result.value
      if (stats.computedAt === null || stats.sampleSize === 0) {
        return <SameContentRow content={<p className="state">{EMPTY}</p>} />
      }

      const weapons = weaponBars(stats, filter).map(withItemLabel)
      const uniques = uniqueItemBars(stats, filter).map(withItemLabel)
      const boxes: readonly ItemBox[] = [
        { name: WEAPON, bars: weapons, tone: 'chart-2', formatValue: formatShare },
        { name: UNIQUE, bars: uniques, tone: 'chart-5', formatValue: formatHeadcount }
      ]

      return (
        <div className="section section-cols">
          {boxes.map((box) => (
            <ListBox key={box.name} name={box.name}>
              <RowBars
                bars={box.bars}
                tone={box.tone}
                formatValue={box.formatValue}
                nameWidth={ITEM_NAME_WIDTH}
              />
            </ListBox>
          ))}
        </div>
      )
    }
  }
}
