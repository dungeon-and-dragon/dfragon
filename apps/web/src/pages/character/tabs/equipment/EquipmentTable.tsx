import { MISSING_VALUE } from '#core/capture/cards'
import type {
  EnchantOption,
  EquipmentReinforce,
  EquipmentRow,
  EquipmentView
} from '#core/character/character-equipment'
import { formatPoint, type ItemView } from '#core/character/character-item'
import { itemTableClasses } from './item-classes'
import { ItemCell } from './item-parts'

const REINFORCE_LABELS = { amplify: '증폭', enhance: '강화' } as const
const REINFORCE_TONES = { amplify: 'text-game-amplify', enhance: 'text-game-enhance' } as const

const { scroll, table, head, headEnd, body, row, cell, slot, number, muted, missing } =
  itemTableClasses
const NUMBER_CELL = `${cell} text-right whitespace-nowrap ${number}`

export function EquipmentTable({ view }: { view: EquipmentView }): React.JSX.Element | null {
  const { items, creature, aura } = view

  if (items.length === 0 && creature === null && aura === null) {
    return null
  }

  return (
    <div className={scroll}>
      <table className={`${table} min-w-[920px] table-fixed`}>
        <thead>
          <tr>
            <th scope="col" className={`${head} w-[88px]`}>
              부위
            </th>
            <th scope="col" className={head}>
              장비
            </th>
            <th scope="col" className={`${head} w-[128px]`}>
              강화, 증폭
            </th>
            <th scope="col" className={`${head} w-[320px]`}>
              마법부여
            </th>
            <th scope="col" className={`${headEnd} w-[96px]`}>
              세트 포인트
            </th>
            <th scope="col" className={`${headEnd} w-[80px]`}>
              정밀도
            </th>
          </tr>
        </thead>
        <tbody className={body}>
          {items.map((item, index) => (
            <EquipmentItemRow key={`${item.slotName}-${index}`} item={item} />
          ))}
          {creature !== null && <ExtraRow slotName="크리쳐" item={creature} />}
          {aura !== null && <ExtraRow slotName="오라" item={aura} />}
        </tbody>
      </table>
    </div>
  )
}

function EquipmentItemRow({ item }: { item: EquipmentRow }): React.JSX.Element {
  return (
    <tr className={row}>
      <td className={`${cell} ${slot}`}>{item.slotName}</td>
      <td className={cell}>
        <ItemCell item={item} tune={item.tune} exalted={item.exalted} />
      </td>
      <td className={`${cell} whitespace-nowrap`}>
        <Reinforce reinforce={item.reinforce} refine={item.refine} />
      </td>
      <td className={`${cell} text-xs text-game-enchant`}>
        <Enchants options={item.enchants} />
      </td>
      <td className={`${NUMBER_CELL} ${muted}`}>
        {item.setPoint !== null ? formatPoint(item.setPoint) : MISSING_VALUE}
      </td>
      <td className={NUMBER_CELL}>
        {item.potency !== null ? (
          <span className="text-game-precision">{item.potency}</span>
        ) : (
          <span className={missing}>{MISSING_VALUE}</span>
        )}
      </td>
    </tr>
  )
}

function Enchants({ options }: { options: EnchantOption[] }): React.JSX.Element {
  return (
    <>
      {options.map(({ label, emphasized }, index) => (
        <span key={label} className={emphasized ? undefined : 'text-fg-muted'}>
          {index < options.length - 1 ? `${label}, ` : label}
        </span>
      ))}
    </>
  )
}

function ExtraRow({ slotName, item }: { slotName: string; item: ItemView }): React.JSX.Element {
  return (
    <tr className={row}>
      <td className={`${cell} ${slot}`}>{slotName}</td>
      <td className={cell}>
        <ItemCell item={item} tune={null} exalted={false} />
      </td>
      <td className={`${cell} ${missing}`}>{MISSING_VALUE}</td>
      <td className={cell} />
      <td className={`${NUMBER_CELL} ${missing}`}>{MISSING_VALUE}</td>
      <td className={`${NUMBER_CELL} ${missing}`}>{MISSING_VALUE}</td>
    </tr>
  )
}

function Reinforce({
  reinforce,
  refine
}: {
  reinforce: EquipmentReinforce | null
  refine: number | null
}): React.JSX.Element {
  if (reinforce === null && refine === null) {
    return <span className={missing}>{MISSING_VALUE}</span>
  }

  return (
    <>
      {reinforce !== null && (
        <span
          title={REINFORCE_LABELS[reinforce.kind]}
          className={`${number} font-semibold ${REINFORCE_TONES[reinforce.kind]}`}
        >
          {`+${reinforce.value}`}
        </span>
      )}
      {refine !== null && (
        <span className={`text-xs text-game-refine ${reinforce !== null ? 'ml-2' : ''}`}>
          재련 <span className={number}>{refine}</span>
        </span>
      )}
    </>
  )
}
