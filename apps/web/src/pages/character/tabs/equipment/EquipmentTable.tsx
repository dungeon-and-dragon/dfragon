import { MISSING_VALUE } from '#shared/lib/missing-value'
import {
  type EnchantOption,
  type EquipmentReinforce,
  type EquipmentRow,
  type EquipmentView,
  type ItemView,
  enhancementTextClasses
} from '#entities/character'
import { itemTableClasses } from './item-classes'
import { ItemCell } from './item-parts'

const REINFORCE_LABELS = { amplify: '증폭', enhance: '강화' } as const

const { slot, missing } = itemTableClasses

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
            <th scope="col" className="w-[400px]">
              마법부여
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
        <ItemCell item={item} tune={item.tune} exalted={item.exalted} potency={item.potency} />
      </td>
      <td className="whitespace-nowrap">
        <Reinforce reinforce={item.reinforce} refine={item.refine} />
      </td>
      <td className="text-xs text-game-enchant">
        <Enchants options={item.enchants} />
      </td>
    </tr>
  )
}

function Enchants({ options }: { options: EnchantOption[] }): React.JSX.Element {
  const important = joinLabels(options.filter(({ emphasized }) => emphasized))
  const minor = joinLabels(options.filter(({ emphasized }) => !emphasized))

  return (
    <>
      {important !== '' && <span className="block">{important}</span>}
      {minor !== '' && <span className="block text-2xs text-fg-muted">{minor}</span>}
    </>
  )
}

function joinLabels(options: EnchantOption[]): string {
  return options.map(({ label }) => label).join(', ')
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
          className={`num font-semibold ${enhancementTextClasses[reinforce.kind]}`}
        >
          {`+${reinforce.value}`}
        </span>
      )}
      {refine !== null && (
        <span
          className={`text-xs ${enhancementTextClasses.refine} ${reinforce !== null ? 'ml-2' : ''}`}
        >
          재련 <span className="num">{refine}</span>
        </span>
      )}
    </>
  )
}
