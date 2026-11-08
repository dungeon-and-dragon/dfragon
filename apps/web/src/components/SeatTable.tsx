import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { seatTableColumns as columns } from './SeatTable.columns'
import { styles } from './SeatTable.style'

export function SeatTable({
  label,
  children
}: {
  label: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <table aria-label={label} {...stylex.props(styles.table)}>
      <colgroup>
        {columns.map((column) => (
          <col
            key={column.label}
            {...stylex.props('width' in column && styles.width(column.width))}
          />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.label}
              scope="col"
              {...stylex.props(styles.header, 'style' in column && column.style)}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}
