import {
  type CharacterDetailView,
  formatStatValue,
  type StatusLine,
  toStatusLayout
} from '#entities/character'
import type { CharacterTabProps } from './character-tab-props'
import { detailTabClasses as layout } from './detail-tab-classes'

type NamedStat = CharacterDetailView['status']['status'][number]
type StatusBuff = CharacterDetailView['status']['buff'][number]

export function StatusTab({ detail }: CharacterTabProps): React.JSX.Element {
  const { main, rest } = toStatusLayout(detail.status.status.filter(isShownStat))
  const buffs = detail.status.buff.filter((buff) => buff.name != null)

  return (
    <div className={layout.tab}>
      {main.length > 0 && <StatGrid label="스탯" stats={main} />}
      {rest.length > 0 && <StatGrid label="그 밖의 스탯" stats={rest} spaced />}
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

function StatGrid({
  label,
  stats,
  spaced = false
}: {
  label: string
  stats: StatusLine[]
  spaced?: boolean
}): React.JSX.Element {
  return (
    <dl
      aria-label={label}
      className={`grid grid-cols-4 gap-x-6 max-sm:grid-cols-2${spaced ? ' mt-8' : ''}`}
    >
      {stats.map((stat) => (
        <div
          key={stat.name}
          className="flex min-w-0 items-center justify-between gap-2 border-b border-line py-3"
        >
          <dt
            className={`flex min-w-0 items-center gap-1 ${stat.emphasized ? 'font-semibold text-fg' : 'text-fg-muted'}`}
          >
            {stat.name}
          </dt>
          <dd className={`shrink-0 num text-fg${stat.emphasized ? ' font-semibold' : ''}`}>
            {formatStatValue(stat.value)}
          </dd>
        </div>
      ))}
    </dl>
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
      {buff.level != null && <span className="num text-fg-subtle">{`Lv ${buff.level}`}</span>}
      {values !== '' && <span className="text-fg-muted tabular-nums">{values}</span>}
    </li>
  )
}
