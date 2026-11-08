import * as stylex from '@stylexjs/stylex'
import { MISSING_VALUE } from '@dfragon/client-core/constants/cards'
import type {
  EnchantOption,
  EquipmentReinforce,
  EquipmentRow,
  EquipmentView
} from '@dfragon/client-core/lib/character-equipment'
import { formatPoint, type ItemView } from '@dfragon/client-core/lib/character-item'
import { ItemCell } from './item-parts'
import { styles as tableStyles } from './item-table.style'
import { styles } from './EquipmentTable.style'

const REINFORCE_LABELS = { amplify: '증폭', enhance: '강화' } as const

export function EquipmentTable({ view }: { view: EquipmentView }): React.JSX.Element | null {
  const { items, creature, aura } = view

  if (items.length === 0 && creature === null && aura === null) {
    return null
  }

  return (
    <table {...stylex.props(tableStyles.table)}>
      <thead>
        <tr>
          <th scope="col" {...stylex.props(tableStyles.head, tableStyles.first, styles.slotColumn)}>
            부위
          </th>
          <th scope="col" {...stylex.props(tableStyles.head)}>
            장비
          </th>
          <th scope="col" {...stylex.props(tableStyles.head, styles.reinforceColumn)}>
            강화, 증폭
          </th>
          <th scope="col" {...stylex.props(tableStyles.head, styles.enchantColumn)}>
            마법부여
          </th>
          <th scope="col" {...stylex.props(tableStyles.head, tableStyles.end, styles.pointColumn)}>
            세트 포인트
          </th>
          <th
            scope="col"
            {...stylex.props(
              tableStyles.head,
              tableStyles.end,
              tableStyles.last,
              styles.potencyColumn
            )}
          >
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
  )
}

function EquipmentItemRow({ item }: { item: EquipmentRow }): React.JSX.Element {
  return (
    <tr {...stylex.props(tableStyles.row)}>
      <td {...stylex.props(tableStyles.cell, tableStyles.first, tableStyles.slot)}>
        {item.slotName}
      </td>
      <td {...stylex.props(tableStyles.cell)}>
        <ItemCell item={item} tune={item.tune} exalted={item.exalted} />
      </td>
      <td {...stylex.props(tableStyles.cell, tableStyles.nowrap)}>
        <Reinforce reinforce={item.reinforce} refine={item.refine} />
      </td>
      <td {...stylex.props(tableStyles.cell, styles.enchant)}>
        <Enchants options={item.enchants} />
      </td>
      <td
        {...stylex.props(
          tableStyles.cell,
          tableStyles.end,
          tableStyles.nowrap,
          tableStyles.number,
          tableStyles.muted
        )}
      >
        {item.setPoint !== null ? formatPoint(item.setPoint) : MISSING_VALUE}
      </td>
      <td
        {...stylex.props(
          tableStyles.cell,
          tableStyles.end,
          tableStyles.last,
          tableStyles.nowrap,
          tableStyles.number
        )}
      >
        {item.potency !== null ? (
          <span {...stylex.props(styles.potency)}>{item.potency}</span>
        ) : (
          <span {...stylex.props(tableStyles.missing)}>{MISSING_VALUE}</span>
        )}
      </td>
    </tr>
  )
}

function Enchants({ options }: { options: EnchantOption[] }): React.JSX.Element {
  return (
    <>
      {options.map(({ label, emphasized }, index) => (
        <span key={label} {...stylex.props(!emphasized && styles.minorEnchant)}>
          {index < options.length - 1 ? `${label}, ` : label}
        </span>
      ))}
    </>
  )
}

function ExtraRow({ slotName, item }: { slotName: string; item: ItemView }): React.JSX.Element {
  return (
    <tr {...stylex.props(tableStyles.row)}>
      <td {...stylex.props(tableStyles.cell, tableStyles.first, tableStyles.slot)}>{slotName}</td>
      <td {...stylex.props(tableStyles.cell)}>
        <ItemCell item={item} tune={null} exalted={false} />
      </td>
      <td {...stylex.props(tableStyles.cell, tableStyles.missing)}>{MISSING_VALUE}</td>
      <td {...stylex.props(tableStyles.cell)} />
      <td {...stylex.props(tableStyles.cell, tableStyles.end, tableStyles.missing)}>
        {MISSING_VALUE}
      </td>
      <td
        {...stylex.props(tableStyles.cell, tableStyles.end, tableStyles.last, tableStyles.missing)}
      >
        {MISSING_VALUE}
      </td>
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
    return <span {...stylex.props(tableStyles.missing)}>{MISSING_VALUE}</span>
  }

  return (
    <>
      {reinforce !== null && (
        <span
          title={REINFORCE_LABELS[reinforce.kind]}
          {...stylex.props(tableStyles.number, styles[reinforce.kind])}
        >
          {`+${reinforce.value}`}
        </span>
      )}
      {refine !== null && (
        <span {...stylex.props(tableStyles.number, styles.refine)}>{`재련 ${refine}`}</span>
      )}
    </>
  )
}
