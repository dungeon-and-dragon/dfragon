import type { ItemView } from '#core/character/character-item'
import { itemTableClasses } from './item-classes'
import { ItemCell } from './item-parts'

export type SlotItemRow = Readonly<{ key: string; slot: React.ReactNode; item: ItemView }>

const { table, head, body, row, cell, slot: slotCell } = itemTableClasses

export function SlotItemTable({
  itemLabel,
  rows
}: {
  itemLabel: string
  rows: readonly SlotItemRow[]
}): React.JSX.Element {
  return (
    <table className={table}>
      <thead>
        <tr>
          <th scope="col" className={`${head} w-24`}>
            부위
          </th>
          <th scope="col" className={head}>
            {itemLabel}
          </th>
        </tr>
      </thead>
      <tbody className={body}>
        {rows.map(({ key, slot, item }) => (
          <tr key={key} className={row}>
            <td className={`${cell} ${slotCell}`}>{slot}</td>
            <td className={cell}>
              <ItemCell item={item} tune={null} exalted={false} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
