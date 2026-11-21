import type { ItemView } from '#entities/character'
import { itemTableClasses } from './item-classes'
import { ItemCell } from './item-parts'

export type SlotItemRow = Readonly<{ key: string; slot: React.ReactNode; item: ItemView }>

const { slot: slotCell } = itemTableClasses

export function SlotItemTable({
  itemLabel,
  rows
}: {
  itemLabel: string
  rows: readonly SlotItemRow[]
}): React.JSX.Element {
  return (
    <table className="table">
      <thead>
        <tr>
          <th scope="col" className="w-[96px] max-sm:hidden">
            부위
          </th>
          <th scope="col">{itemLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ key, slot, item }) => (
          <tr key={key}>
            <td className={`${slotCell} max-sm:hidden`}>{slot}</td>
            <td>
              <ItemCell item={item} tune={null} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
