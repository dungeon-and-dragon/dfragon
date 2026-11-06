import * as stylex from '@stylexjs/stylex'
import { MISSING_VALUE } from '@dfragon/client-core/constants/cards'
import { formatCount, formatPoint, type StatLine } from '@dfragon/client-core/lib/character-item'
import { type OathView, toOathView } from '@dfragon/client-core/lib/character-oath'
import type { CharacterTabProps } from './character-tab-props'
import { styles as tableStyles } from './equipment/item-table.style'
import { ItemIcon, ItemName, RarityBadge, TuneNumeral } from './equipment/item-parts'
import { styles as partStyles } from './equipment/item-parts.style'
import { styles } from './oath/OathTab.style'

export function OathTab({ detail }: CharacterTabProps): React.JSX.Element | null {
  if (detail.oath === null) {
    return null
  }

  const view = toOathView(detail.oath)

  return (
    <div {...stylex.props(tableStyles.root)}>
      <OathStrip view={view} />
      <div {...stylex.props(styles.body)}>
        <OathCrystals view={view} />
        <OathEffects view={view} />
      </div>
    </div>
  )
}

function OathStrip({ view: { info, set } }: { view: OathView }): React.JSX.Element | null {
  if (info === null && set === null) {
    return null
  }

  return (
    <div {...stylex.props(partStyles.strip)}>
      {info !== null && (
        <span {...stylex.props(partStyles.itemText)}>
          <span {...stylex.props(partStyles.stripLabel)}>서약</span>
          <ItemName name={info.itemName} rarity={info.rarity} />
          {info.setPoint !== null && (
            <span {...stylex.props(partStyles.stripMuted)}>{formatPoint(info.setPoint)}</span>
          )}
        </span>
      )}
      <span {...stylex.props(partStyles.spacer)} />
      {set !== null && (
        <span {...stylex.props(partStyles.itemText)}>
          <span {...stylex.props(partStyles.stripLabel)}>서약 세트</span>
          <ItemName name={set.name} rarity={set.rarity} />
          {set.optionName !== null && (
            <span {...stylex.props(partStyles.stripMuted)}>{set.optionName}</span>
          )}
          {set.rarityName !== null && (
            <RarityBadge rarity={set.rarity}>{set.rarityName}</RarityBadge>
          )}
          {set.point !== null && (
            <span {...stylex.props(partStyles.stripMuted)}>{formatPoint(set.point)}</span>
          )}
        </span>
      )}
    </div>
  )
}

function OathCrystals({ view: { crystals } }: { view: OathView }): React.JSX.Element | null {
  if (crystals.length === 0) {
    return null
  }

  return (
    <section aria-label="서약 결정" {...stylex.props(styles.crystals)}>
      <h2 {...stylex.props(tableStyles.heading)}>
        서약 결정 <span {...stylex.props(tableStyles.count)}>{formatCount(crystals.length)}</span>
      </h2>
      <table {...stylex.props(tableStyles.table)}>
        <thead>
          <tr>
            <th
              scope="col"
              {...stylex.props(tableStyles.head, tableStyles.first, styles.slotColumn)}
            >
              칸
            </th>
            <th scope="col" {...stylex.props(tableStyles.head)}>
              결정
            </th>
            <th
              scope="col"
              {...stylex.props(
                tableStyles.head,
                tableStyles.end,
                tableStyles.last,
                styles.pointColumn
              )}
            >
              세트 포인트
            </th>
          </tr>
        </thead>
        <tbody>
          {crystals.map((crystal, index) => (
            <tr key={`${crystal.slot}-${index}`} {...stylex.props(tableStyles.row)}>
              <td
                {...stylex.props(
                  tableStyles.cell,
                  tableStyles.first,
                  tableStyles.slot,
                  tableStyles.number
                )}
              >
                {crystal.slot ?? MISSING_VALUE}
              </td>
              <td {...stylex.props(tableStyles.cell)}>
                <div {...stylex.props(partStyles.item)}>
                  <ItemIcon itemId={crystal.itemId} rarity={crystal.rarity} />
                  <span {...stylex.props(partStyles.itemText)}>
                    <ItemName name={crystal.itemName} rarity={crystal.rarity} />
                    <TuneNumeral numeral={crystal.tune} />
                  </span>
                </div>
              </td>
              <td
                {...stylex.props(
                  tableStyles.cell,
                  tableStyles.end,
                  tableStyles.last,
                  tableStyles.number,
                  tableStyles.muted
                )}
              >
                {crystal.setPoint !== null ? formatPoint(crystal.setPoint) : MISSING_VALUE}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function OathEffects({
  view: { setStatus, blessing, upgrade }
}: {
  view: OathView
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.side)}>
      <StatSection title="서약 세트 효과" lines={setStatus} />
      <StatSection title="서약의 가호" lines={blessing} />
      {upgrade !== null && <StatSection title={upgrade.title} lines={upgrade.lines} />}
    </div>
  )
}

function StatSection({
  title,
  lines
}: {
  title: string | null
  lines: StatLine[]
}): React.JSX.Element | null {
  if (lines.length === 0) {
    return null
  }

  return (
    <section aria-label={title ?? undefined}>
      {title !== null && <h2 {...stylex.props(tableStyles.heading)}>{title}</h2>}
      <dl {...stylex.props(styles.list)}>
        {lines.map(({ name, value }, index) => (
          <div key={`${name}-${index}`} {...stylex.props(styles.line)}>
            <dt {...stylex.props(styles.term)}>{name}</dt>
            <dd {...stylex.props(styles.value)}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
