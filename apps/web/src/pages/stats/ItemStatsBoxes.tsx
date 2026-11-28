import type { BarTone } from '#shared/ui/chart/RowBars'
import { ListBox } from '#shared/ui/ListBox'
import { ItemRowBars } from './ItemRowBars'
import { type SetStatsFilter, useItemStats } from '#entities/ranking'
import { formatHeadcount, type ItemBar, uniqueItemBars, weaponBars } from './item-stats-bars'
import { formatShare } from './set-stats-bars'

const WEAPON = '무기'
const UNIQUE = '유일 장비'
const EMPTY = '아이템 통계가 없습니다.'
const FAILED = '아이템 통계를 받지 못했습니다.'

type ItemBox = Readonly<{
  name: string
  bars: readonly ItemBar[]
  tone: BarTone
  formatValue: (value: number) => string
}>

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

      const weapons = weaponBars(stats, filter)
      const uniques = uniqueItemBars(stats, filter)
      const boxes: readonly ItemBox[] = [
        { name: WEAPON, bars: weapons, tone: 'chart-2', formatValue: formatShare },
        { name: UNIQUE, bars: uniques, tone: 'chart-5', formatValue: formatHeadcount }
      ]

      return (
        <div className="section section-cols">
          {boxes.map((box) => (
            <ListBox key={box.name} name={box.name}>
              <ItemRowBars
                bars={box.bars}
                tone={box.tone}
                formatValue={box.formatValue}
                barFromMd
              />
            </ListBox>
          ))}
        </div>
      )
    }
  }
}
