import * as stylex from '@stylexjs/stylex'
import { formatCount, queueLabel } from '../format'
import { useQueues } from '../ops-queries'
import { panelStyles, tableStyles } from './panel.style'

export function QueuePanel(): React.JSX.Element {
  const queues = useQueues()

  return (
    <section aria-label="타임라인 queue" {...stylex.props(panelStyles.box)}>
      <h2 {...stylex.props(panelStyles.heading)}>타임라인 queue</h2>
      <table {...stylex.props(tableStyles.table)}>
        <thead>
          <tr>
            <th {...stylex.props(tableStyles.headerCell)}>queue</th>
            <th {...stylex.props(tableStyles.headerCell, tableStyles.end)}>대기</th>
            <th {...stylex.props(tableStyles.headerCell, tableStyles.end)}>처리 중</th>
          </tr>
        </thead>
        <tbody>
          {queues.data?.queues.map((queue) => (
            <tr key={queue.name} {...stylex.props(tableStyles.row)}>
              <td {...stylex.props(tableStyles.cell)}>{queueLabel(queue.name)}</td>
              <td {...stylex.props(tableStyles.cell, tableStyles.end, tableStyles.numeric)}>
                {formatCount(queue.waiting)}
              </td>
              <td {...stylex.props(tableStyles.cell, tableStyles.end, tableStyles.numeric)}>
                {formatCount(queue.running)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
