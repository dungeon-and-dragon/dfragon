import { formatStatValue, statusElementOf } from '#core/character/character-detail-display'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import type { CharacterTabProps } from './character-tab-props'
import { detailTabClasses as layout } from './detail-tab-classes'

type NamedStat = CharacterDetailView['status']['status'][number]
type StatusBuff = CharacterDetailView['status']['buff'][number]

export function StatusTab({ detail }: CharacterTabProps): React.JSX.Element {
  const stats = detail.status.status.filter(isShownStat)
  const buffs = detail.status.buff.filter((buff) => buff.name != null)

  return (
    <div className={layout.tab}>
      {stats.length > 0 && (
        <dl aria-label="스탯" className="m-0 grid grid-cols-4 gap-x-6 max-sm:grid-cols-2">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className="flex min-w-0 items-center justify-between gap-2 border-b border-line py-3"
            >
              <dt className="m-0 flex min-w-0 items-center gap-1 text-fg-muted">
                {/* 속성 아이콘 그림이 저장소에 들어오기 전까지 자리만 둔다. */}
                {statusElementOf(stat.name) != null && (
                  <span aria-hidden="true" className="size-4 shrink-0" />
                )}
                {stat.name}
              </dt>
              <dd className="m-0 shrink-0 font-mono text-fg tabular-nums">
                {formatStatValue(stat.value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {buffs.length > 0 && (
        <section aria-label="적용 중인 버프" className={layout.section}>
          <h2 className={layout.heading}>적용 중인 버프</h2>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {buffs.map((buff) => (
              <StatusBuffRow key={buff.name} buff={buff} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function isShownStat(
  stat: NamedStat
): stat is NamedStat & { name: string; value: number | string } {
  return stat.name != null && stat.value != null
}

function StatusBuffRow({ buff }: { buff: StatusBuff }): React.JSX.Element {
  const values = buff.status
    .filter(isShownStat)
    .map((stat) => `${stat.name} ${formatStatValue(stat.value)}`)
    .join(', ')

  return (
    <li className="flex items-baseline gap-2">
      <span className="font-semibold">{buff.name}</span>
      {buff.level != null && (
        <span className="font-mono text-fg-subtle tabular-nums">{`Lv.${buff.level}`}</span>
      )}
      {values !== '' && <span className="text-fg-muted tabular-nums">{values}</span>}
    </li>
  )
}
