import { formatCount, queueLabel } from '../format'
import { useQueues } from '../ops-queries'
import { panelClasses, tableClasses, textClasses } from './panel-classes'

export function QueuePanel(): React.JSX.Element {
  const queues = useQueues()

  return (
    <section aria-label="타임라인 queue" className={panelClasses.box}>
      <h2 className={panelClasses.heading}>타임라인 queue</h2>
      <table className={tableClasses.table}>
        <thead>
          <tr>
            <th className={tableClasses.headCell}>queue</th>
            <th className={tableClasses.headCellEnd}>대기</th>
            <th className={tableClasses.headCellEnd}>처리 중</th>
          </tr>
        </thead>
        <tbody className={tableClasses.body}>
          {queues.data?.queues.map((queue) => (
            <tr key={queue.name} className={tableClasses.row}>
              <td className={tableClasses.cell}>{queueLabel(queue.name)}</td>
              <td className={`${tableClasses.cellEnd} ${textClasses.numeric}`}>
                {formatCount(queue.waiting)}
              </td>
              <td className={`${tableClasses.cellEnd} ${textClasses.numeric}`}>
                {formatCount(queue.running)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
