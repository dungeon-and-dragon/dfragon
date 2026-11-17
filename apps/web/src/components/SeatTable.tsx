import type { ReactNode } from 'react'
import { tableClasses } from './table/table-classes'
import { seatTableColumns as columns } from './SeatTable.columns'

export function SeatTable({
  label,
  children
}: {
  label: string
  children: ReactNode
}): React.JSX.Element {
  return (
    // 열 폭을 내용과 관계없이 지키도록 고정 배치로 두고, 넘치는 글자는 칸 안에서 말줄임한다.
    <table aria-label={label} className={`${tableClasses.table} text-sm`}>
      <colgroup>
        {columns.map((column) => (
          <col key={column.label} style={'width' in column ? { width: column.width } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.label}
              scope="col"
              className={`${tableClasses.headCell} whitespace-nowrap ${'end' in column ? 'text-right' : 'text-left'}`}
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
