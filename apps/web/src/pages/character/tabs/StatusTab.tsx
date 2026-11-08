import * as stylex from '@stylexjs/stylex'
import { formatStatValue, statusElementOf } from '#core/shared/search/character-detail-display'
import type { CharacterDetailView } from '#core/shared/search/character-detail-view'
import type { CharacterTabProps } from './character-tab-props'
import { styles as layout } from './avatar/detail-tab.style'
import { styles } from './status/StatusTab.style'

type NamedStat = CharacterDetailView['status']['status'][number]
type StatusBuff = CharacterDetailView['status']['buff'][number]

export function StatusTab({ detail }: CharacterTabProps): React.JSX.Element {
  const stats = detail.status.status.filter(isShownStat)
  const buffs = detail.status.buff.filter((buff) => buff.name != null)

  return (
    <div {...stylex.props(layout.tab)}>
      {stats.length > 0 && (
        <dl aria-label="스탯" {...stylex.props(styles.grid)}>
          {stats.map((stat) => (
            <div key={stat.name} {...stylex.props(styles.stat)}>
              <dt {...stylex.props(styles.name)}>
                {/* 속성 아이콘 그림이 저장소에 들어오기 전까지 자리만 둔다. */}
                {statusElementOf(stat.name) != null && (
                  <span aria-hidden="true" {...stylex.props(styles.elementIcon)} />
                )}
                {stat.name}
              </dt>
              <dd {...stylex.props(styles.value)}>{formatStatValue(stat.value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {buffs.length > 0 && (
        <section aria-label="적용 중인 버프" {...stylex.props(layout.section)}>
          <h2 {...stylex.props(layout.heading)}>적용 중인 버프</h2>
          <ul {...stylex.props(styles.buffs)}>
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
    <li {...stylex.props(styles.buff)}>
      <span {...stylex.props(styles.buffName)}>{buff.name}</span>
      {buff.level != null && <span {...stylex.props(styles.buffLevel)}>{`Lv.${buff.level}`}</span>}
      {values !== '' && <span {...stylex.props(styles.buffStatus)}>{values}</span>}
    </li>
  )
}
