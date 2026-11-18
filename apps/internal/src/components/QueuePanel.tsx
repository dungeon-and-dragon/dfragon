import { formatCount, queueLabel } from '#app/format'
import { useQueues } from '#app/ops-queries'
import { panelClasses } from './panel-classes'

export function QueuePanel(): React.JSX.Element {
  const queues = useQueues()

  return (
    <section aria-label="타임라인 queue" className={panelClasses.box}>
      <h2 className="section-title">타임라인 queue</h2>
      <table className="table">
        <thead>
          <tr>
            <th>queue</th>
            <th className="table-num">대기</th>
            <th className="table-num">처리 중</th>
          </tr>
        </thead>
        <tbody>
          {queues.data?.queues.map((queue) => (
            <tr key={queue.name}>
              <td>{queueLabel(queue.name)}</td>
              <td className="table-num">{formatCount(queue.waiting)}</td>
              <td className="table-num">{formatCount(queue.running)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
