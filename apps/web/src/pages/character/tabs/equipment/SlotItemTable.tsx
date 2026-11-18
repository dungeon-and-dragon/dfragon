import type { ItemView } from '#core/character'
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
          <th scope="col" className="w-[96px]">
            부위
          </th>
          <th scope="col">{itemLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ key, slot, item }) => (
          <tr key={key}>
            <td className={`${slotCell}`}>{slot}</td>
            <td>
              <ItemCell item={item} tune={null} exalted={false} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
