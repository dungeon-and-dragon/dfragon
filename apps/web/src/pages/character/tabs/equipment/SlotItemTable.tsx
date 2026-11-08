import * as stylex from '@stylexjs/stylex'
import type { ItemView } from '#core/lib/character-item'
import { ItemCell } from './item-parts'
import { styles as tableStyles } from './item-table.style'
import { styles } from './SlotItemTable.style'

export type SlotItemRow = Readonly<{ key: string; slot: React.ReactNode; item: ItemView }>

export function SlotItemTable({
  itemLabel,
  rows
}: {
  itemLabel: string
  rows: readonly SlotItemRow[]
}): React.JSX.Element {
  return (
    <table {...stylex.props(tableStyles.table)}>
      <thead>
        <tr>
          <th scope="col" {...stylex.props(tableStyles.head, tableStyles.first, styles.slotColumn)}>
            부위
          </th>
          <th scope="col" {...stylex.props(tableStyles.head, tableStyles.last)}>
            {itemLabel}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ key, slot, item }) => (
          <tr key={key} {...stylex.props(tableStyles.row)}>
            <td {...stylex.props(tableStyles.cell, tableStyles.first, tableStyles.slot)}>{slot}</td>
            <td {...stylex.props(tableStyles.cell, tableStyles.last)}>
              <ItemCell item={item} tune={null} exalted={false} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
