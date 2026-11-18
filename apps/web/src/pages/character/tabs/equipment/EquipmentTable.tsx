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

const { slot, muted, missing } = itemTableClasses

export function EquipmentTable({ view }: { view: EquipmentView }): React.JSX.Element | null {
  const { items, creature, aura } = view

  if (items.length === 0 && creature === null && aura === null) {
    return null
  }

  return (
    <div className="table-scroll">
      <table className="table table-wrap table-fixed min-w-[920px]">
        <thead>
          <tr>
            <th scope="col" className="w-[88px]">
              부위
            </th>
            <th scope="col">장비</th>
            <th scope="col" className="w-[128px]">
              강화, 증폭
            </th>
            <th scope="col" className="w-[320px]">
              마법부여
            </th>
            <th scope="col" className="table-num w-[96px]">
              세트 포인트
            </th>
            <th scope="col" className="table-num w-[80px]">
              정밀도
            </th>
          </tr>
        </thead>
        <tbody>
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
    <tr>
      <td className={`${slot}`}>{item.slotName}</td>
      <td>
        <ItemCell item={item} tune={item.tune} exalted={item.exalted} />
      </td>
      <td className="whitespace-nowrap">
        <Reinforce reinforce={item.reinforce} refine={item.refine} />
      </td>
      <td className="text-xs text-game-enchant">
        <Enchants options={item.enchants} />
      </td>
      <td className={`table-num ${muted}`}>
        {item.setPoint !== null ? formatPoint(item.setPoint) : MISSING_VALUE}
      </td>
      <td className="table-num">
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
    <tr>
      <td className={`${slot}`}>{slotName}</td>
      <td>
        <ItemCell item={item} tune={null} exalted={false} />
      </td>
      <td className={`${missing}`}>{MISSING_VALUE}</td>
      <td />
      <td className={`table-num ${missing}`}>{MISSING_VALUE}</td>
      <td className={`table-num ${missing}`}>{MISSING_VALUE}</td>
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
          className={`num font-semibold ${REINFORCE_TONES[reinforce.kind]}`}
        >
          {`+${reinforce.value}`}
        </span>
      )}
      {refine !== null && (
        <span className={`text-xs text-game-refine ${reinforce !== null ? 'ml-2' : ''}`}>
          재련 <span className="num">{refine}</span>
        </span>
      )}
    </>
  )
}
